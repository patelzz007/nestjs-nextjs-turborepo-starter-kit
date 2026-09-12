import { createHash } from "node:crypto";

import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { FileUploadPolicy } from "@workspace/shared";
import { DocumentMimeTypeSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { OBJECT_STORAGE } from "../domain/storage.tokens";
import type { ObjectStorage } from "../domain/object-storage.port";
import type { StoredObjectReference, UploadBatchInput, UploadedFileBuffer } from "./file-upload.types";
import { assertAllowedUploadMime } from "../utils/magic-bytes.util";
import { sanitizeFileName } from "../utils/sanitize-file-name.util";
import { toStorageObjectLocator } from "../utils/storage-locator.util";
import { toCleanPathFromQuarantine } from "../utils/storage-path.util";

@Injectable()
export class FileUploadService {
	public constructor(
		private readonly config: TypedConfigService,
		@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
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
		const container = this.config.storagePrivateBucket;
		const provider = this.config.storageProvider;
		const uploadedLocators: ReturnType<typeof toStorageObjectLocator>[] = [];
		const results: StoredObjectReference[] = [];

		try {
			for (let index = 0; index < input.files.length; index += 1) {
				const file = input.files[index];
				const storagePath = input.buildStoragePath(file, index);
				const locator = toStorageObjectLocator(provider, container, storagePath);
				const uploadResult = await this.storage.upload({
					locator,
					buffer: file.buffer,
					mimeType: file.mimeType,
					metadata: input.metadata ?? {},
				});
				uploadedLocators.push(uploadResult.locator);
				results.push({
					bucket: uploadResult.locator.container,
					path: uploadResult.locator.path,
					generation: uploadResult.revision,
					checksumSha256: createHash("sha256").update(file.buffer).digest("hex"),
					sizeBytes: file.buffer.length,
					fileName: sanitizeFileName(file.fileName),
					mimeType: DocumentMimeTypeSchema.parse(file.mimeType),
				});
			}
			return results;
		} catch (error) {
			for (const uploaded of uploadedLocators) {
				await this.storage.deleteObject(uploaded).catch((): void => undefined);
			}
			throw error;
		}
	}

	public async deleteStoredObject(container: string, path: string): Promise<void> {
		const locator = toStorageObjectLocator(this.config.storageProvider, container, path);
		await this.storage.deleteObject(locator).catch((): void => undefined);
	}

	public async promoteQuarantineToClean(
		container: string,
		quarantinePath: string,
		cleanPath?: string,
	): Promise<{ readonly bucket: string; readonly path: string; readonly generation: string | null }> {
		const destinationPath = cleanPath ?? toCleanPathFromQuarantine(quarantinePath);
		const sourceLocator = toStorageObjectLocator(this.config.storageProvider, container, quarantinePath);
		const destinationLocator = toStorageObjectLocator(this.config.storageProvider, container, destinationPath);
		const copied = await this.storage.copyObject(sourceLocator, destinationLocator);
		await this.deleteStoredObject(container, quarantinePath);
		return { bucket: container, path: copied.locator.path, generation: copied.revision };
	}

	public async getSignedDownloadUrl(container: string, path: string): Promise<string> {
		return this.storage.getSignedDownloadUrl({
			locator: toStorageObjectLocator(this.config.storageProvider, container, path),
			expiresInSeconds: this.config.storageDownloadTtlSeconds,
		});
	}

	public getDownloadExpiresAtEpochMs(): number {
		return Date.now() + this.config.storageDownloadTtlSeconds * 1000;
	}
}
