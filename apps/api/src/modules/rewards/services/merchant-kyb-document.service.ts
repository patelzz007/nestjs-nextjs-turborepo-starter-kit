import { randomUUID } from "node:crypto";

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { KybStatus, StoredFile } from "@prisma/client";
import {
	DocumentMimeTypeSchema,
	EpochMsSchema,
	type FileDownloadDisposition,
	type KybDocumentScanStatus,
	type MerchantKybDocumentDownloadResponse,
	type MerchantKybDocumentRecord,
} from "@workspace/shared";

import { FileService } from "../../files/services/file.service";
import { StoredFileRepository, type StoredFileDbClient } from "../../files/repositories/stored-file.repository";

/** Review outcomes the evidence can no longer change. */
const DECIDED_KYB_STATUSES: readonly KybStatus[] = ["APPROVED", "REJECTED"];

/** The scan state a KYB document shows to merchants and admins (honest: a failed scan is not an infection). */
export function kybDocumentScanStatusOf(file: Pick<StoredFile, "status" | "scanStatus">): KybDocumentScanStatus {
	if (file.status === "QUARANTINED" || file.scanStatus === "INFECTED") {
		return "INFECTED";
	}
	if (file.status === "FAILED") {
		return "SCAN_FAILED";
	}
	if (file.status === "READY" && file.scanStatus === "CLEAN") {
		return "CLEAN";
	}
	return "SCANNING";
}

function toKybDocumentRecord(file: StoredFile): MerchantKybDocumentRecord {
	return {
		id: file.id,
		fileName: file.originalName,
		mimeType: DocumentMimeTypeSchema.parse(file.mimeType),
		sizeBytes: file.sizeBytes,
		scanStatus: kybDocumentScanStatusOf(file),
		uploadedAt: EpochMsSchema.parse(Number(file.createdAt)),
	};
}

/** File states a document may be submitted in: verified bytes, verdict pending or clean. Never PENDING, QUARANTINED, FAILED or DELETED. */
const SUBMITTABLE_FILE_STATUSES: ReadonlySet<string> = new Set<string>(["SCANNING", "PROCESSING", "READY"]);

export interface AttachKybDocumentsOptions {
	/** Review states in which the evidence is final and may no longer be replaced. */
	readonly closedKybStatuses: readonly KybStatus[];
}

@Injectable()
export class MerchantKybDocumentService {
	public constructor(
		private readonly fileService: FileService,
		private readonly repository: StoredFileRepository,
	) {}

	public async getDownloadUrl(documentId: string, organizationId: string, disposition: FileDownloadDisposition = "inline"): Promise<MerchantKybDocumentDownloadResponse> {
		const kybFiles = await this.repository.listActiveOrganizationKybFiles(organizationId);
		const match = kybFiles.find((row) => row.fileId === documentId);
		if (match === undefined) {
			throw new NotFoundException({ message: "Document not found", error: "KYB_DOCUMENT_NOT_FOUND" });
		}

		// The caller authorized `merchant:manage_verification` (merchant) or MERCHANT_ORG:LIST (admin) for this organization.
		const download = await this.fileService.createDownloadUrl(match.file, disposition);
		return {
			documentId,
			scanStatus: kybDocumentScanStatusOf(match.file),
			downloadUrl: download.downloadUrl,
			expiresAt: download.expiresAt,
		};
	}

	public async mapDocumentRecordsFromOrg(organizationId: string): Promise<MerchantKybDocumentRecord[]> {
		const rows = await this.repository.listActiveOrganizationKybFiles(organizationId);
		return rows.map((row) => toKybDocumentRecord(row.file));
	}

	/**
	 * The requested files that are KYB uploads of `organizationId` made by
	 * `uploadedById`, in request order. Any other id (another organization's
	 * file, another category, a deleted or unknown file) is simply absent, so
	 * the answer reveals nothing beyond the caller's own uploads.
	 */
	public async describeOwnUploads(organizationId: string, uploadedById: string, fileIds: readonly string[]): Promise<MerchantKybDocumentRecord[]> {
		const files = await this.repository.findOwnKybUploads(organizationId, uploadedById, fileIds);
		return fileIds.flatMap((fileId: string): MerchantKybDocumentRecord[] => {
			const file = files.find((candidate: StoredFile): boolean => candidate.id === fileId);
			return file === undefined ? [] : [toKybDocumentRecord(file)];
		});
	}

	/**
	 * Replaces the organization's active KYB evidence with `fileIds`, inside the
	 * caller's transaction. The merchant profile row is locked first, so a
	 * submission can never race an admin decision: once the review is in one of
	 * `closedKybStatuses` the evidence is final and the submission is rejected.
	 * Previous evidence links are retired (kept as review history), never deleted.
	 */
	public async attachSubmittedFileIdsInTx(tx: StoredFileDbClient, organizationId: string, fileIds: readonly string[], options: AttachKybDocumentsOptions): Promise<void> {
		await tx.$queryRaw`SELECT 1 FROM organization_merchant_profiles WHERE organization_id = ${organizationId} FOR UPDATE`;
		const profile = await tx.organizationMerchantProfile.findUnique({ where: { organizationId }, select: { kybStatus: true } });
		if (profile === null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}
		if (options.closedKybStatuses.includes(profile.kybStatus)) {
			throw new ConflictException({ message: `Business verification is already ${profile.kybStatus.toLowerCase()}`, error: "KYB_REVIEW_CLOSED" });
		}

		const uniqueIds = [...new Set(fileIds)];
		const files = await this.repository.findFilesByIds(tx, uniqueIds);
		for (const fileId of uniqueIds) {
			const file = files.find((candidate) => candidate.id === fileId);
			if (file?.category !== "MERCHANT_KYB" || file.organizationId !== organizationId) {
				throw new BadRequestException({ message: "Invalid KYB document", error: "KYB_DOCUMENT_INVALID" });
			}
			if (file.status === "PENDING") {
				throw new BadRequestException({ message: "KYB document upload is incomplete", error: "KYB_DOCUMENT_INCOMPLETE" });
			}
			if (!SUBMITTABLE_FILE_STATUSES.has(file.status)) {
				throw new BadRequestException({ message: `KYB document is ${file.status.toLowerCase()} and cannot be submitted`, error: "KYB_DOCUMENT_REJECTED" });
			}
		}

		const submissionId = randomUUID();
		await this.repository.deactivateOrganizationKybFiles(tx, organizationId);
		for (const fileId of uniqueIds) {
			await this.repository.createOrganizationKybFile(tx, organizationId, fileId, submissionId);
		}
		await this.reconcileOrgKybStatusInTx(tx, organizationId);
	}

	/**
	 * Derives the review status from the active evidence, inside the caller's
	 * transaction (submission, or a scan verdict landing later). The profile row
	 * is locked first so a submission and a verdict serialize. Unusable evidence
	 * (infected or never cleared) needs merchant action; once every document is
	 * clean again an ACTION_REQUIRED review returns to PENDING. A decided review
	 * (APPROVED / REJECTED) is never changed here.
	 */
	public async reconcileOrgKybStatusInTx(tx: StoredFileDbClient, organizationId: string): Promise<void> {
		await tx.$queryRaw`SELECT 1 FROM organization_merchant_profiles WHERE organization_id = ${organizationId} FOR UPDATE`;
		const profile = await tx.organizationMerchantProfile.findUnique({ where: { organizationId }, select: { kybStatus: true } });
		if (profile === null || DECIDED_KYB_STATUSES.includes(profile.kybStatus)) {
			return;
		}
		const documents = await this.repository.listActiveOrganizationKybFiles(organizationId, tx);
		if (documents.length === 0) {
			return;
		}
		const statuses = documents.map((document): KybDocumentScanStatus => kybDocumentScanStatusOf(document.file));
		const needsAction = statuses.some((status: KybDocumentScanStatus): boolean => status === "INFECTED" || status === "SCAN_FAILED");
		const allClean = statuses.every((status: KybDocumentScanStatus): boolean => status === "CLEAN");
		const nextStatus: KybStatus | null = needsAction ? "ACTION_REQUIRED" : allClean && profile.kybStatus === "ACTION_REQUIRED" ? "PENDING" : null;
		if (nextStatus === null || nextStatus === profile.kybStatus) {
			return;
		}
		await tx.organizationMerchantProfile.update({
			where: { organizationId },
			data: { kybStatus: nextStatus, updatedAt: BigInt(Date.now()) },
		});
	}
}
