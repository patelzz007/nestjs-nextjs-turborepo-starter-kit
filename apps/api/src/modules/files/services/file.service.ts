import { randomUUID } from "node:crypto";

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import {
	CreateFileUploadUrlSchema,
	DocumentMimeTypeSchema,
	EpochMsSchema,
	FileRecordSchema,
	getFileCategoryPolicy,
	type CompleteFileUploadInput,
	type CreateFileUploadUrlInput,
	type CreateFileUploadUrlResponse,
	type FileDownloadDisposition,
	type FileDownloadResponse,
	type FileProcessingResult,
	type FileRecord,
	type StorageObjectLocator,
} from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import type { PublicDelivery } from "../../storage/domain/public-delivery.port";
import { OBJECT_STORAGE, PUBLIC_DELIVERY } from "../../storage/domain/storage.tokens";
import { buildStagingPath } from "../../storage/utils/file-path.util";
import { assertAllowedUploadMime, MAGIC_BYTES_PREFIX_LENGTH, UploadContentRejectedError } from "../../storage/utils/magic-bytes.util";
import { digestStream, readStreamPrefix } from "../../storage/utils/object-stream.util";
import { legacyBucketFieldsFromLocator, locatorFromStoredFile, toStorageObjectLocator } from "../../storage/utils/storage-locator.util";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { FileFinalizationService } from "./file-finalization.service";
import { FileOwnerUnresolvedError, resolveUploadOwnerId } from "./file-ownership.util";
import { isPublicFile } from "./file-visibility.util";
import { StorageTaskDispatcher } from "./storage-task-dispatcher";

const PRESIGNED_UPLOAD_TTL_SECONDS = 300;
const MS_PER_SECOND = 1_000;

/**
 * File lifecycle entry points: upload tickets, upload completion, downloads and deletes.
 *
 * Lifecycle: PENDING (ticket issued) → SCANNING (bytes verified: size, SHA-256,
 * magic bytes) → READY | QUARANTINED | FAILED (malware verdict, applied by
 * {@link FileFinalizationService}) → DELETED (soft delete). Nothing is
 * downloadable or bound to a product/avatar/store before READY.
 */
@Injectable()
export class FileService {
	public constructor(
		private readonly config: TypedConfigService,
		private readonly repository: StoredFileRepository,
		private readonly finalization: FileFinalizationService,
		private readonly dispatcher: StorageTaskDispatcher,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
		@Inject(PUBLIC_DELIVERY) private readonly publicDelivery: PublicDelivery,
	) {}

	public async createUploadUrl(userId: string, input: CreateFileUploadUrlInput): Promise<CreateFileUploadUrlResponse> {
		const parsed = CreateFileUploadUrlSchema.parse(input);
		const policy = getFileCategoryPolicy(parsed.category);
		this.assertUploadAuthorized(userId, parsed);
		this.assertUploadWithinPolicy(parsed, policy);

		const fileId = randomUUID();
		const storagePath = buildStagingPath({
			category: parsed.category,
			ownerId: this.resolveOwnerId(parsed),
			fileId,
			fileName: parsed.fileName,
			mimeType: parsed.mimeType,
		});
		const locator = toStorageObjectLocator(this.config.storageProvider, this.config.storagePrivateBucket, storagePath);

		await this.repository.create({
			id: fileId,
			...legacyBucketFieldsFromLocator(locator),
			category: parsed.category,
			visibility: policy.visibility,
			originalName: parsed.fileName,
			mimeType: parsed.mimeType,
			sizeBytes: parsed.sizeBytes,
			expectedChecksum: parsed.checksumSha256,
			storagePath,
			uploadedById: userId,
			organizationId: parsed.organizationId,
			productId: parsed.category === "PRODUCT_IMAGE" ? parsed.productId : undefined,
		});

		const ticket = await this.storage.createBrowserUploadTicket({
			locator,
			mimeType: parsed.mimeType,
			maxBytes: policy.maxBytes,
			checksumSha256: parsed.checksumSha256,
			expiresInSeconds: PRESIGNED_UPLOAD_TTL_SECONDS,
			metadata: {
				fileId,
				category: parsed.category,
				uploadedById: userId,
			},
		});

		return {
			fileId,
			objectPath: storagePath,
			expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS,
			method: ticket.method,
			uploadUrl: ticket.uploadUrl,
			...(ticket.fields !== undefined ? { fields: ticket.fields } : {}),
			...(ticket.headers !== undefined ? { headers: ticket.headers } : {}),
		};
	}

	/**
	 * Verifies the uploaded bytes (size, SHA-256, magic bytes against the
	 * category allowlist), claims the file PENDING → SCANNING exactly once, and
	 * dispatches the malware scan. The response reflects the state after
	 * dispatch: SCANNING while a queued scan runs, or the verdict when it ran inline.
	 */
	public async completeUpload(userId: string, fileId: string, input: CompleteFileUploadInput): Promise<{ file: FileRecord }> {
		const file = await this.requireFile(fileId);
		if (file.uploadedById !== userId) {
			throw new ForbiddenException({ message: "Not allowed to complete this upload", error: "FILE_UPLOAD_FORBIDDEN" });
		}
		if (file.status !== "PENDING") {
			throw new ConflictException({ message: "Upload already completed", error: "FILE_UPLOAD_ALREADY_COMPLETED" });
		}
		if (file.expectedChecksum !== input.checksumSha256) {
			throw new BadRequestException({ message: "Checksum mismatch", error: "FILE_CHECKSUM_MISMATCH" });
		}

		const locator = locatorFromStoredFile(file, this.config.storageProvider);
		const head = await this.storage.headObject(locator);
		if (head === null) {
			throw new BadRequestException({ message: "Uploaded object not found", error: "FILE_OBJECT_MISSING" });
		}
		if (head.sizeBytes !== file.sizeBytes) {
			throw new BadRequestException({ message: "Uploaded size mismatch", error: "FILE_SIZE_MISMATCH" });
		}
		const resolvedChecksum = head.checksumSha256Hex ?? (await this.streamChecksum(locator));
		if (resolvedChecksum !== input.checksumSha256) {
			throw new BadRequestException({ message: "Object checksum mismatch", error: "FILE_OBJECT_CHECKSUM_MISMATCH" });
		}
		await this.assertContentMatchesDeclaredType(file, locator);

		const claimed = await this.repository.claimPendingForScan(fileId, userId, {
			actualChecksum: resolvedChecksum,
			objectGeneration: head.revision,
			objectRevision: head.revision,
		});
		if (!claimed) {
			throw new ConflictException({ message: "Upload already completed", error: "FILE_UPLOAD_ALREADY_COMPLETED" });
		}

		await this.dispatcher.dispatchScan(fileId);
		// After an inline scan the file may already be READY/QUARANTINED/FAILED; with a queue it is SCANNING.
		return { file: this.mapFileRecord(await this.requireFile(fileId)) };
	}

	/** Loads a live file record (404 otherwise). Callers authorize the operation before acting on it. */
	public async requireFile(fileId: string): Promise<StoredFile> {
		const file = await this.repository.findById(fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		return file;
	}

	/** Short-lived signed URL for an already-authorized file; `null` until it is READY. */
	public async createDownloadUrl(file: StoredFile, disposition: FileDownloadDisposition = "inline"): Promise<FileDownloadResponse> {
		if (file.status !== "READY") {
			return { fileId: file.id, status: file.status, downloadUrl: null, expiresAt: null };
		}

		const downloadUrl = await this.storage.getSignedDownloadUrl({
			locator: locatorFromStoredFile(file, this.config.storageProvider),
			fileId: file.id,
			expiresInSeconds: this.config.storageDownloadTtlSeconds,
			disposition,
			fileName: file.originalName,
		});
		return {
			fileId: file.id,
			status: file.status,
			downloadUrl,
			expiresAt: EpochMsSchema.parse(this.config.storageDownloadTtlSeconds * MS_PER_SECOND + Date.now()),
		};
	}

	/**
	 * Soft-deletes an already-authorized file together with every record that
	 * references it (product image, store asset, avatar, KYB link), withdraws a
	 * published public asset at once (a deleted file is never served publicly,
	 * on any provider), then dispatches the delayed physical delete of the
	 * private original. Submitted KYB evidence is retained.
	 */
	public async deleteStoredFile(file: StoredFile, actorUserId: string): Promise<void> {
		if (file.category === "MERCHANT_KYB" && (await this.repository.hasKybSubmissionReference(file.id))) {
			throw new ConflictException({ message: "Submitted verification evidence is retained and cannot be deleted", error: "KYB_EVIDENCE_RETAINED" });
		}
		const deleted = await this.repository.softDeleteWithReferences(file.id, actorUserId);
		if (!deleted) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		const locator = locatorFromStoredFile(file, this.config.storageProvider);
		if (isPublicFile(file) && file.publicPath !== null) {
			await this.withdrawPublicAsset(file, locator);
		}
		await this.dispatcher.dispatchPhysicalDelete({
			fileId: file.id,
			provider: locator.provider,
			container: locator.container,
			path: locator.path,
		});
	}

	/**
	 * Stops public delivery now (the provider removes its public copy or
	 * revokes the URL) and hands any CDN cache purge to the dispatcher, so the
	 * request never waits on — or fails because of — the CDN.
	 */
	private async withdrawPublicAsset(file: StoredFile, locator: StorageObjectLocator): Promise<void> {
		const withdrawal = await this.publicDelivery.unpublishAsset({ locator, fileId: file.id });
		if (withdrawal.cachedObjectKeys.length > 0) {
			await this.dispatcher.dispatchCdnInvalidation({ fileId: file.id, objectKeys: [...withdrawal.cachedObjectKeys] });
		}
	}

	/** Result posted by an external processing worker (authenticated by the controller). */
	public async applyProcessingResult(input: FileProcessingResult): Promise<void> {
		await this.finalization.applyProcessingResult(input);
	}

	public mapFileRecord(file: StoredFile): FileRecord {
		return FileRecordSchema.parse({
			id: file.id,
			category: file.category,
			visibility: file.visibility,
			originalName: file.originalName,
			mimeType: DocumentMimeTypeSchema.parse(file.mimeType),
			sizeBytes: file.sizeBytes,
			status: file.status,
			scanStatus: file.scanStatus,
			publicUrl: file.publicPath,
			uploadedAt: EpochMsSchema.parse(Number(file.createdAt)),
		});
	}

	private async streamChecksum(locator: StorageObjectLocator): Promise<string> {
		const stream = await this.storage.getObjectStream(locator);
		if (stream === null) {
			throw new BadRequestException({ message: "Uploaded object not found", error: "FILE_OBJECT_MISSING" });
		}
		return (await digestStream(stream)).sha256Hex;
	}

	/** The bytes must be what the upload declared, and that type must be allowed for the category. */
	private async assertContentMatchesDeclaredType(file: StoredFile, locator: StorageObjectLocator): Promise<void> {
		const stream = await this.storage.getObjectStream(locator);
		if (stream === null) {
			throw new BadRequestException({ message: "Uploaded object not found", error: "FILE_OBJECT_MISSING" });
		}
		const prefix = await readStreamPrefix(stream, MAGIC_BYTES_PREFIX_LENGTH);
		try {
			assertAllowedUploadMime(prefix, file.mimeType, getFileCategoryPolicy(file.category).allowedMimeTypes);
		} catch (error) {
			if (error instanceof UploadContentRejectedError) {
				throw new BadRequestException({ message: error.message, error: "FILE_CONTENT_TYPE_MISMATCH" });
			}
			throw error;
		}
	}

	private assertUploadAuthorized(userId: string, input: CreateFileUploadUrlInput): void {
		if (input.category === "USER_AVATAR" && input.userId !== userId) {
			throw new ForbiddenException({ message: "Cannot upload avatar for another user", error: "FILE_UPLOAD_FORBIDDEN" });
		}
	}

	private assertUploadWithinPolicy(input: CreateFileUploadUrlInput, policy: ReturnType<typeof getFileCategoryPolicy>): void {
		if (input.sizeBytes > policy.maxBytes) {
			throw new BadRequestException({ message: "File exceeds maximum allowed size", error: "FILE_TOO_LARGE" });
		}
		if (!policy.allowedMimeTypes.includes(input.mimeType)) {
			throw new BadRequestException({ message: "Disallowed MIME type", error: "FILE_INVALID_MIME" });
		}
	}

	private resolveOwnerId(input: CreateFileUploadUrlInput): string {
		try {
			return resolveUploadOwnerId(input);
		} catch (error) {
			if (error instanceof FileOwnerUnresolvedError) {
				throw new BadRequestException({ message: error.message, error: "FILE_RESOURCE_REQUIRED" });
			}
			throw error;
		}
	}
}
