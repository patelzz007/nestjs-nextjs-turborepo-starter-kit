import { createHash, randomUUID } from "node:crypto";

import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";
import {
	CreateFileUploadUrlSchema,
	DocumentMimeTypeSchema,
	EpochMsSchema,
	FileProcessingResultSchema,
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
import { OBJECT_STORAGE, PUBLIC_DELIVERY } from "../../storage/domain/storage.tokens";
import type { ObjectStorage } from "../../storage/domain/object-storage.port";
import type { PublicDelivery } from "../../storage/domain/public-delivery.port";
import { buildFinalStoragePath, buildStagingPath, isStagingPath, type BuildFileObjectPathInput } from "../../storage/utils/file-path.util";
import { legacyBucketFieldsFromLocator, locatorFromStoredFile, toStorageObjectLocator } from "../../storage/utils/storage-locator.util";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { StorageQueueService } from "./storage-queue.service";

const PRESIGNED_UPLOAD_TTL_SECONDS = 300;

@Injectable()
export class FileService {
	private readonly logger: Logger = new Logger(FileService.name);

	public constructor(
		private readonly config: TypedConfigService,
		private readonly repository: StoredFileRepository,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
		@Inject(PUBLIC_DELIVERY) private readonly publicDelivery: PublicDelivery,
		@Optional() private readonly storageQueue: StorageQueueService | null,
	) {}

	public async createUploadUrl(userId: string, input: CreateFileUploadUrlInput): Promise<CreateFileUploadUrlResponse> {
		const parsed = CreateFileUploadUrlSchema.parse(input);
		const policy = getFileCategoryPolicy(parsed.category);
		this.assertUploadAuthorized(userId, parsed);
		this.assertUploadWithinPolicy(parsed, policy);

		const fileId = randomUUID();
		const ownerId = this.resolveOwnerId(parsed);
		const storagePath = buildStagingPath({
			category: parsed.category,
			ownerId,
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
			merchantOrgId: parsed.merchantOrgId,
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

	public async completeUpload(userId: string, fileId: string, input: CompleteFileUploadInput): Promise<{ file: FileRecord }> {
		const file = await this.repository.findById(fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		if (file.uploadedById !== userId) {
			throw new ForbiddenException({ message: "Not allowed to complete this upload", error: "FILE_UPLOAD_FORBIDDEN" });
		}
		if (file.status !== "PENDING") {
			throw new BadRequestException({ message: "Upload already completed", error: "FILE_UPLOAD_ALREADY_COMPLETED" });
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

		const resolvedChecksum = head.checksumSha256Hex ?? (await this.resolveChecksumFromObject(locator));
		if (resolvedChecksum !== input.checksumSha256) {
			throw new BadRequestException({ message: "Object checksum mismatch", error: "FILE_OBJECT_CHECKSUM_MISMATCH" });
		}

		const updated = await this.repository.updateStatus(fileId, "PROCESSING", {
			actualChecksum: input.checksumSha256,
			objectGeneration: head.revision,
			objectRevision: head.revision,
		});

		await this.bindFileToResource(updated);

		try {
			await this.applyProcessingResult({
				fileId,
				status: "READY",
				scanStatus: "CLEAN",
				scanResult: "ready",
			});
		} catch (error) {
			this.logger.error(`Finalize failed for file ${fileId}: ${String(error)}`);
			await this.applyProcessingResult({
				fileId,
				status: "FAILED",
				scanResult: error instanceof Error ? error.message : "finalize-failed",
			});
		}

		const finalized = await this.repository.findById(fileId);
		if (finalized === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		return { file: this.mapFileRecord(finalized) };
	}

	public async getFile(userId: string, fileId: string): Promise<FileRecord> {
		const file = await this.repository.findById(fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		if (file.uploadedById !== userId) {
			throw new ForbiddenException({ message: "Not allowed to view this file", error: "FILE_VIEW_FORBIDDEN" });
		}
		return this.mapFileRecord(file);
	}

	public async getDownloadUrl(userId: string, fileId: string, disposition: FileDownloadDisposition = "inline"): Promise<FileDownloadResponse> {
		const file = await this.repository.findById(fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		if (file.uploadedById !== userId && file.merchantOrgId === null) {
			throw new ForbiddenException({ message: "Not allowed to download this file", error: "FILE_DOWNLOAD_FORBIDDEN" });
		}
		if (file.status === "SCANNING" || file.status === "PROCESSING" || file.status === "PENDING" || file.status === "UPLOADED") {
			return { fileId, status: file.status, downloadUrl: null, expiresAt: null };
		}
		if (file.status === "QUARANTINED" || file.status === "FAILED" || file.status === "DELETED") {
			return { fileId, status: file.status, downloadUrl: null, expiresAt: null };
		}

		const locator = locatorFromStoredFile(file, this.config.storageProvider);
		const downloadUrl = await this.storage.getSignedDownloadUrl({
			locator,
			expiresInSeconds: this.config.storageDownloadTtlSeconds,
			disposition,
			fileName: file.originalName,
		});
		return {
			fileId,
			status: file.status,
			downloadUrl,
			expiresAt: EpochMsSchema.parse(this.config.storageDownloadTtlSeconds * 1000 + Date.now()),
		};
	}

	public async deleteFile(userId: string, fileId: string): Promise<void> {
		const file = await this.repository.findById(fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		if (file.uploadedById !== userId) {
			throw new ForbiddenException({ message: "Not allowed to delete this file", error: "FILE_DELETE_FORBIDDEN" });
		}
		await this.repository.markDeleted(fileId);
		const locator = locatorFromStoredFile(file, this.config.storageProvider);
		await this.storageQueue?.enqueuePhysicalDelete({
			fileId,
			provider: locator.provider,
			container: locator.container,
			path: locator.path,
		});
	}

	public async applyProcessingResult(input: FileProcessingResult): Promise<void> {
		const parsed = FileProcessingResultSchema.parse(input);
		const file = await this.repository.findById(parsed.fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}

		if (parsed.status === "QUARANTINED") {
			await this.deleteStagingObjectIfPresent(file);
			await this.repository.updateStatus(parsed.fileId, "QUARANTINED", {
				scanStatus: parsed.scanStatus ?? "INFECTED",
				scannedAt: BigInt(Date.now()),
				scanResult: parsed.scanResult ?? "quarantined",
			});
			return;
		}

		if (parsed.status === "FAILED") {
			await this.deleteStagingObjectIfPresent(file);
			await this.repository.updateStatus(parsed.fileId, "FAILED", {
				scanResult: parsed.scanResult ?? "processing-failed",
			});
			return;
		}

		const promoted = await this.promoteToFinalStorage(file, parsed.finalStoragePath);
		const publicPath = file.visibility === "PUBLIC" ? await this.publishPublicAsset(file, promoted.locator) : null;
		await this.repository.updateStatus(parsed.fileId, "READY", {
			storagePath: promoted.locator.path,
			objectGeneration: promoted.revision,
			objectRevision: promoted.revision,
			publicPath,
			scanStatus: parsed.scanStatus ?? "CLEAN",
			scannedAt: BigInt(Date.now()),
			scanResult: parsed.scanResult ?? "ready",
		});
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
			publicUrl: file.publicPath,
			uploadedAt: EpochMsSchema.parse(Number(file.createdAt)),
		});
	}

	private async resolveChecksumFromObject(locator: StorageObjectLocator): Promise<string> {
		const buffer = await this.storage.getObject(locator);
		if (buffer === null) {
			throw new BadRequestException({ message: "Uploaded object not found", error: "FILE_OBJECT_MISSING" });
		}
		return createHash("sha256").update(buffer).digest("hex");
	}

	private async publishPublicAsset(file: StoredFile, locator: StorageObjectLocator): Promise<string> {
		const published = await this.publicDelivery.publishAsset({
			locator,
			mimeType: DocumentMimeTypeSchema.parse(file.mimeType),
			fileName: file.originalName,
		});
		return published.publicUrl;
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
		if (input.category === "PRODUCT_IMAGE" && input.productId !== undefined) {
			return input.productId;
		}
		if (input.merchantOrgId !== undefined) {
			return input.merchantOrgId;
		}
		if (input.userId !== undefined) {
			return input.userId;
		}
		throw new BadRequestException({ message: "Missing resource binding for upload", error: "FILE_RESOURCE_REQUIRED" });
	}

	private async bindFileToResource(file: StoredFile): Promise<void> {
		if (file.category === "PRODUCT_IMAGE") {
			const productId = this.extractProductIdFromPath(file.storagePath);
			if (productId !== null) {
				await this.repository.createProductImage(productId, file.id, 0, true);
			}
			return;
		}
		if (file.category === "STORE_LOGO" && file.merchantOrgId !== null) {
			await this.repository.upsertMerchantAsset(file.merchantOrgId, "LOGO", file.id);
			return;
		}
		if (file.category === "STORE_BANNER" && file.merchantOrgId !== null) {
			await this.repository.upsertMerchantAsset(file.merchantOrgId, "BANNER", file.id);
			return;
		}
		if (file.category === "USER_AVATAR") {
			await this.repository.upsertUserAvatar(file.uploadedById, file.id);
		}
	}

	private extractProductIdFromPath(storagePath: string): string | null {
		const match = /^(?:staging\/)?products\/([^/]+)\//.exec(storagePath);
		return match?.[1] ?? null;
	}

	private buildPathInputFromFile(file: StoredFile): BuildFileObjectPathInput {
		const ownerId = this.resolveOwnerIdFromFile(file);
		return {
			category: file.category,
			ownerId,
			fileId: file.id,
			fileName: file.originalName,
			mimeType: file.mimeType,
		};
	}

	private resolveOwnerIdFromFile(file: StoredFile): string {
		if (file.category === "USER_AVATAR") {
			return file.uploadedById;
		}
		if (file.merchantOrgId !== null) {
			return file.merchantOrgId;
		}
		const productId = this.extractProductIdFromPath(file.storagePath);
		if (productId !== null) {
			return productId;
		}
		throw new BadRequestException({ message: "Unable to resolve storage owner", error: "FILE_RESOURCE_REQUIRED" });
	}

	private async promoteToFinalStorage(file: StoredFile, finalStoragePath?: string): Promise<{ locator: StorageObjectLocator; revision: string | null }> {
		const sourceLocator = locatorFromStoredFile(file, this.config.storageProvider);
		const destinationPath = finalStoragePath ?? buildFinalStoragePath(this.buildPathInputFromFile(file));
		const destinationLocator = toStorageObjectLocator(sourceLocator.provider, sourceLocator.container, destinationPath);

		if (!isStagingPath(file.storagePath)) {
			if (file.storagePath === destinationPath) {
				return { locator: sourceLocator, revision: file.objectRevision ?? file.objectGeneration };
			}
			const copied = await this.storage.copyObject(sourceLocator, destinationLocator);
			return { locator: copied.locator, revision: copied.revision };
		}

		if (finalStoragePath !== undefined && file.storagePath !== finalStoragePath) {
			await this.deleteStagingObjectIfPresent(file);
			return { locator: destinationLocator, revision: file.objectRevision ?? file.objectGeneration };
		}

		const copied = await this.storage.copyObject(sourceLocator, destinationLocator);
		await this.storage.deleteObject(sourceLocator);
		return { locator: copied.locator, revision: copied.revision };
	}

	private async deleteStagingObjectIfPresent(file: StoredFile): Promise<void> {
		if (!isStagingPath(file.storagePath)) {
			return;
		}
		const locator = locatorFromStoredFile(file, this.config.storageProvider);
		await this.storage.deleteObject(locator);
	}
}
