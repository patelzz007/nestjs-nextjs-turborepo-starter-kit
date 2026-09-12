import type { DocumentMimeType } from "@workspace/shared";

export interface UploadedFileBuffer {
	readonly fileName: string;
	readonly mimeType: DocumentMimeType;
	readonly buffer: Buffer;
}

export interface StoredObjectReference {
	readonly bucket: string;
	readonly path: string;
	readonly generation: string | null;
	readonly checksumSha256: string;
	readonly sizeBytes: number;
	readonly fileName: string;
	readonly mimeType: DocumentMimeType;
}

export interface UploadBatchInput {
	readonly files: readonly UploadedFileBuffer[];
	readonly buildStoragePath: (file: UploadedFileBuffer, index: number) => string;
	readonly metadata?: Readonly<Record<string, string>>;
}
