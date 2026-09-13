import { Injectable } from "@nestjs/common";
import type { KybDocumentScanStatus, OrganizationKybDocument } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export interface CreateOrganizationKybDocumentInput {
	readonly id: string;
	readonly organizationId: string;
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
export class OrganizationKybDocumentRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async createMany(records: readonly CreateOrganizationKybDocumentInput[]): Promise<OrganizationKybDocument[]> {
		if (records.length === 0) {
			return [];
		}
		return this.prisma.$transaction(
			records.map((record) =>
				this.prisma.organizationKybDocument.create({
					data: {
						id: record.id,
						organizationId: record.organizationId,
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

	public async listActiveByOrg(organizationId: string): Promise<OrganizationKybDocument[]> {
		return this.prisma.organizationKybDocument.findMany({
			where: { organizationId, isActive: true, isDeleted: false },
			orderBy: { createdAt: "asc" },
		});
	}

	public async findActiveById(documentId: string, organizationId: string): Promise<OrganizationKybDocument | null> {
		return this.prisma.organizationKybDocument.findFirst({
			where: { id: documentId, organizationId, isActive: true, isDeleted: false },
		});
	}

	public async deactivateActiveByOrg(organizationId: string): Promise<OrganizationKybDocument[]> {
		const active = await this.prisma.organizationKybDocument.findMany({
			where: { organizationId, isActive: true, isDeleted: false },
		});
		if (active.length === 0) {
			return [];
		}
		const now = Date.now();
		await this.prisma.organizationKybDocument.updateMany({
			where: { organizationId, isActive: true, isDeleted: false },
			data: { isActive: false, updatedAt: now },
		});
		return active;
	}

	public async applyScanResult(input: {
		readonly documentId: string;
		readonly organizationId: string;
		readonly scanStatus: KybDocumentScanStatus;
		readonly scanResult: string | null;
		readonly storagePath?: string;
		readonly objectGeneration?: string | null;
	}): Promise<OrganizationKybDocument | null> {
		const existing = await this.prisma.organizationKybDocument.findFirst({
			where: { id: input.documentId, organizationId: input.organizationId, isDeleted: false },
		});
		if (existing === null) {
			return null;
		}
		const now = Date.now();
		return this.prisma.organizationKybDocument.update({
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

	public async listBySubmission(organizationId: string, submissionId: string): Promise<OrganizationKybDocument[]> {
		return this.prisma.organizationKybDocument.findMany({
			where: { organizationId, submissionId, isDeleted: false },
			orderBy: { createdAt: "asc" },
		});
	}
}
