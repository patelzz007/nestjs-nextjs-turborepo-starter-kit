import { HttpStatus } from "@nestjs/common";
import {
	EpochMsSchema,
	getFileCategoryPolicy,
	type FileUploadRequest,
	type CreateFileUploadUrlResponse,
	type FileDownloadDisposition,
	type FileDownloadResponse,
	type StorageObjectLocator,
} from "@workspace/shared";

import type { TypedConfigService } from "../../../../config/typed-config.service";
import { AppError } from "../../../../platform/application/errors/app-error";
import { UnreadableImageError } from "../../../../platform/infrastructure/storage/domain/image-processor.port";
import type { ObjectStorage } from "../../../../platform/infrastructure/storage/domain/object-storage.port";
import type { PublicDelivery } from "../../../../platform/infrastructure/storage/domain/public-delivery.port";
import { buildStagingPath } from "../../../../platform/infrastructure/storage/utils/file-path.util";
import { assertAllowedUploadMime, MAGIC_BYTES_PREFIX_LENGTH, UploadContentRejectedError } from "../../../../platform/infrastructure/storage/utils/magic-bytes.util";
import { digestStream, readStreamPrefix } from "../../../../platform/infrastructure/storage/utils/object-stream.util";
import { toStorageObjectLocator } from "../../../../platform/infrastructure/storage/utils/storage-locator.util";
import type { VerifiedUpload } from "../../domain/aggregates/stored-file.aggregate";
import type { FileObjectStoragePort, UploadTicketRequest } from "../../application/ports/file-object-storage.port";
import type { StoredFileView } from "../../application/ports/stored-file-read.port";
import { ImageRulesViolationError, type ImageRenditionService } from "./image-rendition.service";

/** A browser upload ticket is valid for five minutes. */
const PRESIGNED_UPLOAD_TTL_SECONDS = 300;
const MS_PER_SECOND = 1_000;

function badRequest(code: string, message: string): AppError {
	return new AppError({ code, httpStatus: HttpStatus.BAD_REQUEST, message });
}

/** The stored file is on another provider than the one this deployment runs (a migration in progress). */
export class InactiveStorageProviderError extends Error {
	public constructor(locator: StorageObjectLocator, activeProvider: string) {
		super(`Object ${locator.path} is stored on provider "${locator.provider}" but the active provider is "${activeProvider}"`);
		this.name = "InactiveStorageProviderError";
	}
}

/** {@link FileObjectStoragePort} over the platform object-storage and public-delivery ports. Built by FilesModule. */
export class StorageFileObjectAdapter implements FileObjectStoragePort {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly storage: ObjectStorage,
		private readonly publicDelivery: PublicDelivery,
		private readonly renditions: ImageRenditionService,
	) {}

	public stagingLocator(input: FileUploadRequest, fileId: string, ownerId: string): StorageObjectLocator {
		const path = buildStagingPath({ category: input.category, ownerId, fileId, fileName: input.fileName, mimeType: input.mimeType });
		return toStorageObjectLocator(this.config.storage.provider, this.config.storage.privateContainer, path);
	}

	public async issueUploadTicket(request: UploadTicketRequest): Promise<CreateFileUploadUrlResponse> {
		const ticket = await this.storage.createBrowserUploadTicket({
			locator: this.active(request.locator),
			mimeType: request.input.mimeType,
			maxBytes: request.maxBytes,
			checksumSha256: request.input.checksumSha256,
			expiresInSeconds: PRESIGNED_UPLOAD_TTL_SECONDS,
			metadata: { fileId: request.fileId, category: request.input.category, uploadedById: request.uploadedById },
		});
		return {
			fileId: request.fileId,
			objectPath: request.locator.path,
			expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS,
			method: ticket.method,
			uploadUrl: ticket.uploadUrl,
			...(ticket.fields === undefined ? {} : { fields: ticket.fields }),
			...(ticket.headers === undefined ? {} : { headers: ticket.headers }),
		};
	}

	public async verifyUpload(file: StoredFileView, checksumSha256: string): Promise<VerifiedUpload> {
		const locator = this.active(file.locator);
		const head = await this.storage.headObject(locator);
		if (head === null) {
			throw badRequest("FILE_OBJECT_MISSING", "Uploaded object not found");
		}
		if (head.sizeBytes !== file.sizeBytes) {
			throw badRequest("FILE_SIZE_MISMATCH", "Uploaded size mismatch");
		}
		const actualChecksum = head.checksumSha256Hex ?? (await this.streamChecksum(locator));
		if (actualChecksum !== checksumSha256) {
			throw badRequest("FILE_OBJECT_CHECKSUM_MISMATCH", "Object checksum mismatch");
		}
		await this.assertContentMatchesDeclaredType(file, locator);
		const dimensions = await this.inspectImage(file, locator);
		return { actualChecksum, objectRevision: head.revision, imageWidth: dimensions?.width ?? null, imageHeight: dimensions?.height ?? null };
	}

	public async createDownloadUrl(file: StoredFileView, disposition: FileDownloadDisposition): Promise<FileDownloadResponse> {
		if (file.status !== "READY") {
			return { fileId: file.id, status: file.status, downloadUrl: null, expiresAt: null };
		}
		const downloadUrl = await this.storage.getSignedDownloadUrl({
			locator: this.active(file.locator),
			fileId: file.id,
			expiresInSeconds: this.config.storage.downloadTtlSeconds,
			disposition,
			fileName: file.originalName,
		});
		return {
			fileId: file.id,
			status: file.status,
			downloadUrl,
			expiresAt: EpochMsSchema.parse(this.config.storage.downloadTtlSeconds * MS_PER_SECOND + Date.now()),
		};
	}

	public async withdrawPublicCopy(fileId: string, locator: StorageObjectLocator): Promise<readonly string[]> {
		const withdrawal = await this.publicDelivery.unpublishAsset({ locator: this.active(locator), fileId });
		return withdrawal.cachedObjectKeys;
	}

	public async deleteObject(locator: StorageObjectLocator): Promise<void> {
		await this.storage.deleteObject(this.active(locator));
	}

	private active(locator: StorageObjectLocator): StorageObjectLocator {
		if (locator.provider !== this.config.storage.provider) {
			throw new InactiveStorageProviderError(locator, this.config.storage.provider);
		}
		return locator;
	}

	private async streamChecksum(locator: StorageObjectLocator): Promise<string> {
		const stream = await this.storage.getObjectStream(locator);
		if (stream === null) {
			throw badRequest("FILE_OBJECT_MISSING", "Uploaded object not found");
		}
		return (await digestStream(stream)).sha256Hex;
	}

	/** The bytes must be what the upload declared, and that type must be allowed for the category. */
	private async assertContentMatchesDeclaredType(file: StoredFileView, locator: StorageObjectLocator): Promise<void> {
		const stream = await this.storage.getObjectStream(locator);
		if (stream === null) {
			throw badRequest("FILE_OBJECT_MISSING", "Uploaded object not found");
		}
		const prefix = await readStreamPrefix(stream, MAGIC_BYTES_PREFIX_LENGTH);
		try {
			assertAllowedUploadMime(prefix, file.mimeType, getFileCategoryPolicy(file.category).allowedMimeTypes);
		} catch (error) {
			if (error instanceof UploadContentRejectedError) {
				throw badRequest("FILE_CONTENT_TYPE_MISMATCH", error.message);
			}
			throw error;
		}
	}

	/** An image category's pixel rules, checked on the stored bytes (`null`: the category has none). */
	private async inspectImage(file: StoredFileView, locator: StorageObjectLocator): Promise<{ readonly width: number; readonly height: number } | null> {
		try {
			return await this.renditions.inspectUpload(file, locator);
		} catch (error) {
			if (error instanceof ImageRulesViolationError) {
				throw badRequest("FILE_IMAGE_DIMENSIONS_INVALID", error.message);
			}
			if (error instanceof UnreadableImageError) {
				throw badRequest("FILE_IMAGE_UNREADABLE", "The image could not be read. Upload a JPEG, PNG, WebP or AVIF photo.");
			}
			throw error;
		}
	}
}
