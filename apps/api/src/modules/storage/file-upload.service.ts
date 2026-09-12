import { createHash } from "node:crypto";

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { FileUploadPolicy } from "@workspace/shared";
import { DocumentMimeTypeSchema } from "@workspace/shared";

import { TypedConfigService } from "../../config/typed-config.service";

import { OBJECT_STORAGE } from "./storage.tokens";
import type { ObjectStorageService } from "./storage.types";
import type { StoredObjectReference, UploadBatchInput, UploadedFileBuffer } from "./file-upload.types";
import { assertAllowedUploadMime } from "./utils/magic-bytes.util";
import { sanitizeFileName } from "./utils/sanitize-file-name.util";
import { toCleanPathFromQuarantine } from "./utils/storage-path.util";

@Injectable()
export class FileUploadService {
	public constructor(
		private readonly config: TypedConfigService,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService,
	) {}

	public validateFiles(files: readonly UploadedFileBuffer[], policy: FileUploadPolicy): void {
		if (files.length < policy.minCount) {
			throw new BadRequestException(policy.emptyFilesMessage);
		}
		if (files.length > policy.maxCount) {
			throw new BadRequestException(policy.maxCountMessage);
		}
		for (const file of files) {
			if (file.buffer.length > policy.maxBytesPerFile) {
				throw new BadRequestException(policy.maxBytesMessage);
			}
			try {
				assertAllowedUploadMime(file.buffer, file.mimeType, policy.allowedMimeTypes);
			} catch (error) {
				if (error instanceof Error && error.message === "INVALID_MIME") {
					throw new BadRequestException(policy.invalidMimeMessage);
				}
				throw new BadRequestException(`${policy.magicBytesMismatchMessage} (${file.fileName})`);
			}
		}
	}

	public async uploadBatch(input: UploadBatchInput): Promise<readonly StoredObjectReference[]> {
		const bucket = this.config.storageBucket;
		const uploadedPaths: { bucket: string; path: string }[] = [];
		const results: StoredObjectReference[] = [];

		try {
			for (let index = 0; index < input.files.length; index += 1) {
				const file = input.files[index];
				const storagePath = input.buildStoragePath(file, index);
				const uploadResult = await this.storage.upload({
					bucket,
					path: storagePath,
					buffer: file.buffer,
					mimeType: file.mimeType,
					metadata: input.metadata ?? {},
				});
				uploadedPaths.push({ bucket, path: storagePath });
				results.push({
					bucket: uploadResult.bucket,
					path: uploadResult.path,
					generation: uploadResult.generation,
					checksumSha256: createHash("sha256").update(file.buffer).digest("hex"),
					sizeBytes: file.buffer.length,
					fileName: sanitizeFileName(file.fileName),
					mimeType: DocumentMimeTypeSchema.parse(file.mimeType),
				});
			}
			return results;
		} catch (error) {
			for (const uploaded of uploadedPaths) {
				await this.storage.deleteObject(uploaded.bucket, uploaded.path).catch((): void => undefined);
			}
			throw error;
		}
	}

	public async deleteStoredObject(bucket: string, path: string): Promise<void> {
		await this.storage.deleteObject(bucket, path).catch((): void => undefined);
	}

	public async promoteQuarantineToClean(
		bucket: string,
		quarantinePath: string,
		cleanPath?: string,
	): Promise<{ readonly bucket: string; readonly path: string; readonly generation: string | null }> {
		const destinationPath = cleanPath ?? toCleanPathFromQuarantine(quarantinePath);
		const copied = await this.storage.copyObject(bucket, quarantinePath, bucket, destinationPath);
		await this.deleteStoredObject(bucket, quarantinePath);
		return { bucket, path: copied.path, generation: copied.generation };
	}

	public async getSignedDownloadUrl(bucket: string, path: string): Promise<string> {
		return this.storage.getSignedDownloadUrl({
			bucket,
			path,
			expiresInSeconds: this.config.storageDownloadTtlSeconds,
		});
	}

	public getDownloadExpiresAtEpochMs(): number {
		return Date.now() + this.config.storageDownloadTtlSeconds * 1000;
	}
}
