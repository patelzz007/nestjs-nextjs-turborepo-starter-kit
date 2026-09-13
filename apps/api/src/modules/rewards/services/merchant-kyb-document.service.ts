import { randomUUID } from "node:crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
	DocumentMimeTypeSchema,
	EpochMsSchema,
	type FileDownloadDisposition,
	type MerchantKybDocumentDownloadResponse,
	type MerchantKybDocumentRecord,
} from "@workspace/shared";

import { FileService } from "../../files/services/file.service";
import { StoredFileRepository } from "../../files/repositories/stored-file.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";

@Injectable()
export class MerchantKybDocumentService {
	public constructor(
		private readonly fileService: FileService,
		private readonly repository: StoredFileRepository,
		private readonly organizationRepository: OrganizationRepository,
	) {}

	public async getDownloadUrl(documentId: string, organizationId: string, disposition: FileDownloadDisposition = "inline"): Promise<MerchantKybDocumentDownloadResponse> {
		const kybFiles = await this.repository.listActiveOrganizationKybFiles(organizationId);
		const match = kybFiles.find((row) => row.fileId === documentId);
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

	public mapDocumentRecordsFromOrg(organizationId: string): Promise<MerchantKybDocumentRecord[]> {
		return this.repository.listActiveOrganizationKybFiles(organizationId).then((rows) =>
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

	public async reconcileOrgKybStatus(organizationId: string): Promise<void> {
		const documents = await this.repository.listActiveOrganizationKybFiles(organizationId);
		if (documents.length === 0) {
			return;
		}
		const hasInfected = documents.some((document) => document.file.status === "QUARANTINED" || document.file.scanStatus === "INFECTED");
		if (hasInfected) {
			await this.organizationRepository.updateMerchantProfileKyb(organizationId, { kybStatus: "ACTION_REQUIRED" });
			return;
		}
		const allClean = documents.every((document) => document.file.status === "READY" || document.file.scanStatus === "CLEAN");
		if (allClean) {
			const org = await this.organizationRepository.findById(organizationId);
			if (org?.merchantProfile?.kybStatus === "ACTION_REQUIRED") {
				await this.organizationRepository.updateMerchantProfileKyb(organizationId, { kybStatus: "PENDING" });
			}
		}
	}

	public async attachSubmittedFileIds(organizationId: string, fileIds: readonly string[]): Promise<void> {
		const submissionId = randomUUID();
		for (const fileId of fileIds) {
			const file = await this.repository.findById(fileId);
			if (file?.category !== "MERCHANT_KYB" || file.organizationId !== organizationId || file.isDeleted) {
				throw new BadRequestException({ message: "Invalid KYB document", error: "KYB_DOCUMENT_INVALID" });
			}
			if (file.status === "PENDING") {
				throw new BadRequestException({ message: "KYB document upload is incomplete", error: "KYB_DOCUMENT_INCOMPLETE" });
			}
		}
		await this.repository.deactivateOrganizationKybFiles(organizationId);
		for (const fileId of fileIds) {
			await this.repository.createOrganizationKybFile(organizationId, fileId, submissionId);
		}
		await this.reconcileOrgKybStatus(organizationId);
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
