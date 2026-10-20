import type { Prisma, StoredFile } from "@prisma/client";
import { epochMs, type CompleteFileUploadResponse, type CreateFileUploadUrlResponse, type FileDownloadDisposition } from "@workspace/shared";

import type { StoredFileAccess } from "../../../files/public-api";
import type { KybDownload, KybFileAccessPort, KybFileDescriptor, KybFilesInTransaction, KybUploadRequest } from "../../application/ports/kyb-files.port";

function toDescriptor(file: StoredFile): KybFileDescriptor {
	return {
		id: file.id,
		category: file.category,
		tenantId: file.tenantId,
		uploadedById: file.uploadedById,
		status: file.status,
		scanStatus: file.scanStatus,
		originalName: file.originalName,
		mimeType: file.mimeType,
		sizeBytes: file.sizeBytes,
		createdAt: epochMs(Number(file.createdAt)),
	};
}

/** KYB evidence is stored by the files context; this adapter reaches it through files' published `StoredFileAccess`. */
export class KybFilesAdapter implements KybFileAccessPort {
	public constructor(private readonly files: StoredFileAccess) {}

	public async describe(fileIds: readonly string[]): Promise<readonly KybFileDescriptor[]> {
		return (await this.files.findLiveFiles(fileIds)).map(toDescriptor);
	}

	public async createDownloadUrl(fileId: string, disposition: FileDownloadDisposition): Promise<KybDownload> {
		const [file] = await this.files.findLiveFiles([fileId]);
		if (file === undefined) {
			return { downloadUrl: null, expiresAt: null };
		}
		const download = await this.files.createDownloadUrl(file, disposition);
		return { downloadUrl: download.downloadUrl, expiresAt: download.expiresAt };
	}

	public async createUploadUrl(uploaderUserId: string, tenantId: string, upload: KybUploadRequest): Promise<CreateFileUploadUrlResponse> {
		return this.files.createUploadUrl(uploaderUserId, { category: "MERCHANT_KYB", ...upload, tenantId });
	}

	public async completeUpload(uploaderUserId: string, fileId: string, checksumSha256: string): Promise<CompleteFileUploadResponse> {
		return this.files.completeUpload(uploaderUserId, fileId, { checksumSha256 });
	}
}

/** KYB file reads on the unit-of-work transaction (the submission validates and links evidence in one transaction). */
export class TransactionKybFiles implements KybFilesInTransaction {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly files: StoredFileAccess,
	) {}

	public async describe(fileIds: readonly string[]): Promise<readonly KybFileDescriptor[]> {
		return (await this.files.findLiveFiles(fileIds, this.db)).map(toDescriptor);
	}
}
