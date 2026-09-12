import type { DocumentMimeType } from "@workspace/shared";

export interface StorageUploadInput {
	readonly bucket: string;
	readonly path: string;
	readonly buffer: Buffer;
	readonly mimeType: DocumentMimeType;
	readonly metadata?: Readonly<Record<string, string>>;
}

export interface StorageUploadResult {
	readonly bucket: string;
	readonly path: string;
	readonly generation: string | null;
}

export interface StorageSignedUrlInput {
	readonly bucket: string;
	readonly path: string;
	readonly expiresInSeconds: number;
	readonly disposition?: "inline" | "attachment";
	readonly fileName?: string;
}

export interface StoragePresignedPostInput {
	readonly bucket: string;
	readonly path: string;
	readonly mimeType: DocumentMimeType;
	readonly maxBytes: number;
	readonly checksumSha256: string;
	readonly expiresInSeconds: number;
	readonly metadata?: Readonly<Record<string, string>>;
}

export interface StoragePresignedPostResult {
	readonly url: string;
	readonly fields: Readonly<Record<string, string>>;
}

export interface StorageHeadObjectInput {
	readonly bucket: string;
	readonly path: string;
}

export interface StorageHeadObjectResult {
	readonly sizeBytes: number;
	readonly mimeType: string | null;
	readonly checksumSha256: string | null;
	readonly etag: string | null;
}

export interface ObjectStorageService {
	upload(input: StorageUploadInput): Promise<StorageUploadResult>;
	getObject(input: StorageHeadObjectInput): Promise<Buffer | null>;
	deleteObject(bucket: string, path: string): Promise<void>;
	copyObject(sourceBucket: string, sourcePath: string, destBucket: string, destPath: string): Promise<StorageUploadResult>;
	getSignedDownloadUrl(input: StorageSignedUrlInput): Promise<string>;
	createPresignedPost(input: StoragePresignedPostInput): Promise<StoragePresignedPostResult>;
	headObject(input: StorageHeadObjectInput): Promise<StorageHeadObjectResult | null>;
}
