import { randomUUID } from "node:crypto";

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
} from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { OBJECT_STORAGE } from "../../storage/storage.tokens";
import type { ObjectStorageService } from "../../storage/storage.types";
import { sha256Base64ToHex } from "../../storage/utils/checksum.util";
import { buildFinalStoragePath, buildStagingPath, isStagingPath, type BuildFileObjectPathInput } from "../../storage/utils/file-path.util";
import { StoredFileRepository } from "../repositories/stored-file.repository";
import { FileScanService } from "./file-scan.service";
import { StorageQueueService } from "./storage-queue.service";

const PRESIGNED_UPLOAD_TTL_SECONDS = 300;

@Injectable()
export class FileService {
	private readonly logger: Logger = new Logger(FileService.name);

	public constructor(
		private readonly config: TypedConfigService,
		private readonly repository: StoredFileRepository,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService,
		@Optional() private readonly storageQueue: StorageQueueService | null,
		private readonly fileScanService: FileScanService,
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
		const bucket = this.config.storagePrivateBucket;

		await this.repository.create({
			id: fileId,
			category: parsed.category,
			visibility: policy.visibility,
			originalName: parsed.fileName,
			mimeType: parsed.mimeType,
			sizeBytes: parsed.sizeBytes,
			expectedChecksum: parsed.checksumSha256,
			storageBucket: bucket,
			storagePath,
			uploadedById: userId,
			merchantOrgId: parsed.merchantOrgId,
		});

		const presigned = await this.storage.createPresignedPost({
			bucket,
			path: storagePath,
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
			uploadUrl: presigned.url,
			fields: presigned.fields,
			objectKey: storagePath,
			expiresIn: PRESIGNED_UPLOAD_TTL_SECONDS,
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

		const head = await this.storage.headObject({ bucket: file.storageBucket, path: file.storagePath });
		if (head === null) {
			throw new BadRequestException({ message: "Uploaded object not found", error: "FILE_OBJECT_MISSING" });
		}
		if (head.sizeBytes !== file.sizeBytes) {
			throw new BadRequestException({ message: "Uploaded size mismatch", error: "FILE_SIZE_MISMATCH" });
		}
		if (head.checksumSha256 !== null && sha256Base64ToHex(head.checksumSha256) !== input.checksumSha256) {
			throw new BadRequestException({ message: "S3 checksum mismatch", error: "FILE_S3_CHECKSUM_MISMATCH" });
		}

		const nextStatus = getFileCategoryPolicy(file.category).requiresScanning ? "SCANNING" : "PROCESSING";
		const updated = await this.repository.updateStatus(fileId, nextStatus, {
			actualChecksum: input.checksumSha256,
			objectGeneration: head.etag,
			scanStatus: nextStatus === "SCANNING" ? "SCANNING" : undefined,
		});

		await this.bindFileToResource(updated);

		if (nextStatus === "SCANNING") {
			await this.runScanAndFinalize(fileId);
			const scanned = await this.repository.findById(fileId);
			if (scanned === null) {
				throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
			}
			return { file: this.mapFileRecord(scanned) };
		}

		return { file: this.mapFileRecord(updated) };
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

		const downloadUrl = await this.storage.getSignedDownloadUrl({
			bucket: file.storageBucket,
			path: file.storagePath,
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
		await this.storageQueue?.enqueuePhysicalDelete({
			fileId,
			bucket: file.storageBucket,
			path: file.storagePath,
		});
	}

	public async runScanAndFinalize(fileId: string): Promise<void> {
		const file = await this.repository.findById(fileId);
		if (file === null) {
			throw new NotFoundException({ message: "File not found", error: "FILE_NOT_FOUND" });
		}
		if (file.status !== "SCANNING" && file.status !== "PROCESSING") {
			this.logger.warn(`Skipping scan for file ${fileId} with status ${file.status}`);
			return;
		}

		try {
			const scanResult = await this.fileScanService.scanFile(fileId);
			await this.applyProcessingResult({
				fileId,
				status: scanResult.clean ? "READY" : "QUARANTINED",
				scanStatus: scanResult.clean ? "CLEAN" : "INFECTED",
				scanResult: scanResult.scanResult ?? (scanResult.clean ? "clean" : "infected"),
			});
		} catch (error) {
			this.logger.error(`Scan failed for file ${fileId}: ${String(error)}`);
			await this.applyProcessingResult({
				fileId,
				status: "FAILED",
				scanResult: error instanceof Error ? error.message : "scan-failed",
			});
		}
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
		await this.repository.updateStatus(parsed.fileId, "READY", {
			storagePath: promoted.path,
			objectGeneration: promoted.generation,
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

	private async promoteToFinalStorage(file: StoredFile, finalStoragePath?: string): Promise<{ path: string; generation: string | null }> {
		const destinationPath = finalStoragePath ?? buildFinalStoragePath(this.buildPathInputFromFile(file));

		if (!isStagingPath(file.storagePath)) {
			if (file.storagePath === destinationPath) {
				return { path: file.storagePath, generation: file.objectGeneration };
			}
			const copied = await this.storage.copyObject(file.storageBucket, file.storagePath, file.storageBucket, destinationPath);
			return { path: copied.path, generation: copied.generation };
		}

		if (finalStoragePath !== undefined && file.storagePath !== finalStoragePath) {
			await this.deleteStagingObjectIfPresent(file);
			return { path: finalStoragePath, generation: file.objectGeneration };
		}

		const copied = await this.storage.copyObject(file.storageBucket, file.storagePath, file.storageBucket, destinationPath);
		await this.storage.deleteObject(file.storageBucket, file.storagePath);
		return { path: copied.path, generation: copied.generation };
	}

	private async deleteStagingObjectIfPresent(file: StoredFile): Promise<void> {
		if (!isStagingPath(file.storagePath)) {
			return;
		}
		await this.storage.deleteObject(file.storageBucket, file.storagePath);
	}
}
