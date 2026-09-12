import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "../../config/typed-config.service";
import { sha256HexToBase64 } from "./utils/checksum.util";

import type {
	ObjectStorageService,
	StorageHeadObjectInput,
	StorageHeadObjectResult,
	StoragePresignedPostInput,
	StoragePresignedPostResult,
	StorageSignedUrlInput,
	StorageUploadInput,
	StorageUploadResult,
} from "./storage.types";

const LOCAL_ROOT = join(process.cwd(), ".object-storage");

@Injectable()
export class LocalObjectStorageService implements ObjectStorageService {
	public constructor(private readonly config: TypedConfigService) {}

	public async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
		const absolutePath = this.resolvePath(input.bucket, input.path);
		await mkdir(dirname(absolutePath), { recursive: true });
		await writeFile(absolutePath, input.buffer);
		const generation = createHash("sha256").update(input.buffer).digest("hex").slice(0, 16);
		return { bucket: input.bucket, path: input.path, generation };
	}

	public async getObject(input: StorageHeadObjectInput): Promise<Buffer | null> {
		try {
			const absolutePath = this.resolvePath(input.bucket, input.path);
			return await readFile(absolutePath);
		} catch {
			return null;
		}
	}

	public async deleteObject(bucket: string, path: string): Promise<void> {
		const absolutePath = this.resolvePath(bucket, path);
		await rm(absolutePath, { force: true });
	}

	public async copyObject(sourceBucket: string, sourcePath: string, destBucket: string, destPath: string): Promise<StorageUploadResult> {
		const sourceAbsolute = this.resolvePath(sourceBucket, sourcePath);
		const buffer = await readFile(sourceAbsolute);
		return this.upload({ bucket: destBucket, path: destPath, buffer, mimeType: "application/pdf" });
	}

	public getSignedDownloadUrl(input: StorageSignedUrlInput): Promise<string> {
		const absolutePath = this.resolvePath(input.bucket, input.path);
		return Promise.resolve(`file://${absolutePath}`);
	}

	public createPresignedPost(input: StoragePresignedPostInput): Promise<StoragePresignedPostResult> {
		const baseUrl = this.config.apiPublicUrl;
		const fileId = input.metadata?.fileId ?? "";
		return Promise.resolve({
			url: `${baseUrl}/api/v1/files/${fileId}/local-upload`,
			fields: {
				key: input.path,
				"Content-Type": input.mimeType,
				"x-amz-checksum-sha256": input.checksumSha256,
			},
		});
	}

	public async headObject(input: StorageHeadObjectInput): Promise<StorageHeadObjectResult | null> {
		try {
			const absolutePath = this.resolvePath(input.bucket, input.path);
			const buffer = await readFile(absolutePath);
			const checksumHex = createHash("sha256").update(buffer).digest("hex");
			return {
				sizeBytes: buffer.length,
				mimeType: null,
				checksumSha256: sha256HexToBase64(checksumHex),
				etag: createHash("sha256").update(buffer).digest("hex").slice(0, 16),
			};
		} catch {
			return null;
		}
	}

	private resolvePath(bucket: string, path: string): string {
		return join(LOCAL_ROOT, bucket, path);
	}
}
