import { Injectable } from "@nestjs/common";
import type { KybDocumentScanStatus, MerchantKybDocument } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export interface CreateMerchantKybDocumentInput {
	readonly id: string;
	readonly merchantOrgId: string;
	readonly submissionId: string;
	readonly fileName: string;
	readonly mimeType: string;
	readonly sizeBytes: number;
	readonly checksumSha256: string;
	readonly storageBucket: string;
	readonly storagePath: string;
	readonly objectGeneration: string | null;
}

@Injectable()
export class MerchantKybDocumentRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async createMany(records: readonly CreateMerchantKybDocumentInput[]): Promise<MerchantKybDocument[]> {
		if (records.length === 0) {
			return [];
		}
		return this.prisma.$transaction(
			records.map((record) =>
				this.prisma.merchantKybDocument.create({
					data: {
						id: record.id,
						merchantOrgId: record.merchantOrgId,
						submissionId: record.submissionId,
						fileName: record.fileName,
						mimeType: record.mimeType,
						sizeBytes: record.sizeBytes,
						checksumSha256: record.checksumSha256,
						storageBucket: record.storageBucket,
						storagePath: record.storagePath,
						objectGeneration: record.objectGeneration,
						scanStatus: "SCANNING",
						isActive: true,
					},
				}),
			),
		);
	}

	public async listActiveByOrg(merchantOrgId: string): Promise<MerchantKybDocument[]> {
		return this.prisma.merchantKybDocument.findMany({
			where: { merchantOrgId, isActive: true, isDeleted: false },
			orderBy: { createdAt: "asc" },
		});
	}

	public async findActiveById(documentId: string, merchantOrgId: string): Promise<MerchantKybDocument | null> {
		return this.prisma.merchantKybDocument.findFirst({
			where: { id: documentId, merchantOrgId, isActive: true, isDeleted: false },
		});
	}

	public async deactivateActiveByOrg(merchantOrgId: string): Promise<MerchantKybDocument[]> {
		const active = await this.prisma.merchantKybDocument.findMany({
			where: { merchantOrgId, isActive: true, isDeleted: false },
		});
		if (active.length === 0) {
			return [];
		}
		const now = Date.now();
		await this.prisma.merchantKybDocument.updateMany({
			where: { merchantOrgId, isActive: true, isDeleted: false },
			data: { isActive: false, updatedAt: now },
		});
		return active;
	}

	public async applyScanResult(input: {
		readonly documentId: string;
		readonly merchantOrgId: string;
		readonly scanStatus: KybDocumentScanStatus;
		readonly scanResult: string | null;
		readonly storagePath?: string;
		readonly objectGeneration?: string | null;
	}): Promise<MerchantKybDocument | null> {
		const existing = await this.prisma.merchantKybDocument.findFirst({
			where: { id: input.documentId, merchantOrgId: input.merchantOrgId, isDeleted: false },
		});
		if (existing === null) {
			return null;
		}
		const now = Date.now();
		return this.prisma.merchantKybDocument.update({
			where: { id: input.documentId },
			data: {
				scanStatus: input.scanStatus,
				scanResult: input.scanResult,
				scannedAt: now,
				updatedAt: now,
				...(input.storagePath !== undefined ? { storagePath: input.storagePath } : {}),
				...(input.objectGeneration !== undefined ? { objectGeneration: input.objectGeneration } : {}),
				...(input.scanStatus === "INFECTED" ? { isActive: false, isDeleted: true, deletedAt: now } : {}),
			},
		});
	}

	public async listBySubmission(merchantOrgId: string, submissionId: string): Promise<MerchantKybDocument[]> {
		return this.prisma.merchantKybDocument.findMany({
			where: { merchantOrgId, submissionId, isDeleted: false },
			orderBy: { createdAt: "asc" },
		});
	}
}
