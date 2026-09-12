import { randomUUID } from "node:crypto";

import { Injectable, NotFoundException } from "@nestjs/common";
import {
	DocumentMimeTypeSchema,
	EpochMsSchema,
	type FileDownloadDisposition,
	type MerchantKybDocumentDownloadResponse,
	type MerchantKybDocumentRecord,
} from "@workspace/shared";

import { FileService } from "../../files/services/file.service";
import { StoredFileRepository } from "../../files/repositories/stored-file.repository";
import { MerchantOrgRepository } from "../repositories/merchant-org.repository";

@Injectable()
export class MerchantKybDocumentService {
	public constructor(
		private readonly fileService: FileService,
		private readonly repository: StoredFileRepository,
		private readonly merchantOrgRepository: MerchantOrgRepository,
	) {}

	public async getDownloadUrl(documentId: string, merchantOrgId: string, disposition: FileDownloadDisposition = "inline"): Promise<MerchantKybDocumentDownloadResponse> {
		const kybFile = await this.repository.listActiveMerchantKybFiles(merchantOrgId);
		const match = kybFile.find((row) => row.fileId === documentId);
		if (match === undefined) {
			throw new NotFoundException({ message: "Document not found", error: "KYB_DOCUMENT_NOT_FOUND" });
		}

		const download = await this.fileService.getDownloadUrl(match.file.uploadedById, documentId, disposition);
		return {
			documentId,
			scanStatus: this.mapScanStatus(match.file.status, match.file.scanStatus),
			downloadUrl: download.downloadUrl,
			expiresAt: download.expiresAt,
		};
	}

	public mapDocumentRecordsFromOrg(merchantOrgId: string): Promise<MerchantKybDocumentRecord[]> {
		return this.repository.listActiveMerchantKybFiles(merchantOrgId).then((rows) =>
			rows.map((row) => ({
				id: row.fileId,
				fileName: row.file.originalName,
				mimeType: DocumentMimeTypeSchema.parse(row.file.mimeType),
				sizeBytes: row.file.sizeBytes,
				scanStatus: this.mapScanStatus(row.file.status, row.file.scanStatus),
				uploadedAt: EpochMsSchema.parse(Number(row.file.createdAt)),
			})),
		);
	}

	public async reconcileOrgKybStatus(merchantOrgId: string): Promise<void> {
		const documents = await this.repository.listActiveMerchantKybFiles(merchantOrgId);
		if (documents.length === 0) {
			return;
		}
		const hasInfected = documents.some((document) => document.file.status === "QUARANTINED" || document.file.scanStatus === "INFECTED");
		if (hasInfected) {
			await this.merchantOrgRepository.updateKyb(merchantOrgId, { kybStatus: "ACTION_REQUIRED" });
			return;
		}
		const allClean = documents.every((document) => document.file.status === "READY" || document.file.scanStatus === "CLEAN");
		if (allClean) {
			const org = await this.merchantOrgRepository.findById(merchantOrgId);
			if (org !== null && org.kybStatus === "ACTION_REQUIRED") {
				await this.merchantOrgRepository.updateKyb(merchantOrgId, { kybStatus: "PENDING" });
			}
		}
	}

	public async attachSubmittedFileIds(merchantOrgId: string, fileIds: readonly string[]): Promise<void> {
		const submissionId = randomUUID();
		await this.repository.deactivateMerchantKybFiles(merchantOrgId);
		for (const fileId of fileIds) {
			await this.repository.createMerchantKybFile(merchantOrgId, fileId, submissionId);
		}
		await this.reconcileOrgKybStatus(merchantOrgId);
	}

	private mapScanStatus(status: string, scanStatus: string | null): "SCANNING" | "CLEAN" | "INFECTED" {
		if (status === "QUARANTINED" || scanStatus === "INFECTED" || status === "FAILED") {
			return "INFECTED";
		}
		if (status === "READY" || scanStatus === "CLEAN") {
			return "CLEAN";
		}
		return "SCANNING";
	}
}
