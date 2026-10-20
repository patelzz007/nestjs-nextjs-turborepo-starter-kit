import type { CreateFileUploadUrlInput, CreateFileUploadUrlResponse, FileDownloadDisposition, FileDownloadResponse, StorageObjectLocator } from "@workspace/shared";

import type { VerifiedUpload } from "../../domain/aggregates/stored-file.aggregate";
import type { StoredFileView } from "./stored-file-read.port";

/** A browser upload ticket for a file row that already exists. */
export interface UploadTicketRequest {
	readonly fileId: string;
	readonly uploadedById: string;
	readonly locator: StorageObjectLocator;
	readonly input: CreateFileUploadUrlInput;
	readonly maxBytes: number;
}

/**
 * Everything the files use cases need from object storage and public delivery.
 * Implemented in infrastructure over the platform storage ports; the
 * application never sees a provider SDK.
 */
export interface FileObjectStoragePort {
	/** The private staging location a new upload's bytes go to. */
	stagingLocator(input: CreateFileUploadUrlInput, fileId: string, ownerId: string): StorageObjectLocator;

	issueUploadTicket(request: UploadTicketRequest): Promise<CreateFileUploadUrlResponse>;

	/**
	 * Verifies the uploaded bytes against the row and the ticket: present, the
	 * declared size, the SHA-256, magic bytes allowed for the category, and the
	 * category's pixel rules. Throws the documented 400 errors otherwise.
	 */
	verifyUpload(file: StoredFileView, checksumSha256: string): Promise<VerifiedUpload>;

	/** Short-lived signed URL for an already-authorized file; no URL until it is READY. */
	createDownloadUrl(file: StoredFileView, disposition: FileDownloadDisposition): Promise<FileDownloadResponse>;

	/** Stops public delivery of one copy now; returns the CDN keys that may still hold it. */
	withdrawPublicCopy(fileId: string, locator: StorageObjectLocator): Promise<readonly string[]>;

	deleteObject(locator: StorageObjectLocator): Promise<void>;
}
