import type { CompleteFileUploadResponse, CreateFileUploadUrlResponse, EpochMs, FileDownloadDisposition, MerchantOnboardingDocumentUploadItem } from "@workspace/shared";

import type { KybEvidenceFile } from "../../domain/policies/kyb-evidence.policy";

/** A KYB evidence file as merchants and admins see it. */
export interface KybFileDescriptor extends KybEvidenceFile {
	readonly originalName: string;
	readonly mimeType: string;
	readonly sizeBytes: number;
	readonly createdAt: EpochMs;
}

/** File reads bound to the caller's unit of work (the files context owns `StoredFile`). */
export interface KybFilesInTransaction {
	/** Live files among `fileIds` (missing ids are absent). */
	describe(fileIds: readonly string[]): Promise<readonly KybFileDescriptor[]>;
}

/** One requested KYB upload. */
export type KybUploadRequest = MerchantOnboardingDocumentUploadItem;

export interface KybDownload {
	readonly downloadUrl: string | null;
	readonly expiresAt: EpochMs | null;
}

/** File operations outside a unit of work (signed URLs, upload tickets and completion). */
export interface KybFileAccessPort {
	describe(fileIds: readonly string[]): Promise<readonly KybFileDescriptor[]>;
	createDownloadUrl(fileId: string, disposition: FileDownloadDisposition): Promise<KybDownload>;
	createUploadUrl(uploaderUserId: string, organizationId: string, upload: KybUploadRequest): Promise<CreateFileUploadUrlResponse>;
	completeUpload(uploaderUserId: string, fileId: string, checksumSha256: string): Promise<CompleteFileUploadResponse>;
}
