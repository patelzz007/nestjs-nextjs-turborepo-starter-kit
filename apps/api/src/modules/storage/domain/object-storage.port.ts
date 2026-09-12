import type { DocumentMimeType, StorageObjectLocator } from "@workspace/shared";

export interface StorageUploadInput {
	readonly locator: StorageObjectLocator;
	readonly buffer: Buffer;
	readonly mimeType: DocumentMimeType;
	readonly metadata?: Readonly<Record<string, string>>;
}

export interface StorageUploadResult {
	readonly locator: StorageObjectLocator;
	readonly revision: string | null;
}

export interface StorageSignedUrlInput {
	readonly locator: StorageObjectLocator;
	readonly expiresInSeconds: number;
	readonly disposition?: "inline" | "attachment";
	readonly fileName?: string;
}

export interface StorageBrowserUploadTicketInput {
	readonly locator: StorageObjectLocator;
	readonly mimeType: DocumentMimeType;
	readonly maxBytes: number;
	readonly checksumSha256: string;
	readonly expiresInSeconds: number;
	readonly metadata?: Readonly<Record<string, string>>;
}

export interface StorageBrowserUploadTicketResult {
	readonly method: "POST_MULTIPART" | "PUT";
	readonly uploadUrl: string;
	readonly fields?: Readonly<Record<string, string>>;
	readonly headers?: Readonly<Record<string, string>>;
}

export interface StorageHeadObjectResult {
	readonly sizeBytes: number;
	readonly mimeType: string | null;
	readonly checksumSha256Hex: string | null;
	readonly revision: string | null;
}

/** Provider-neutral private object storage port. */
export interface ObjectStorage {
	upload(input: StorageUploadInput): Promise<StorageUploadResult>;
	getObject(locator: StorageObjectLocator): Promise<Buffer | null>;
	deleteObject(locator: StorageObjectLocator): Promise<void>;
	copyObject(source: StorageObjectLocator, destination: StorageObjectLocator): Promise<StorageUploadResult>;
	getSignedDownloadUrl(input: StorageSignedUrlInput): Promise<string>;
	createBrowserUploadTicket(input: StorageBrowserUploadTicketInput): Promise<StorageBrowserUploadTicketResult>;
	headObject(locator: StorageObjectLocator): Promise<StorageHeadObjectResult | null>;
}
