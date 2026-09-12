import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { FileCategory, FileStatus, StoredObjectScanStatus } from "@workspace/shared";
import type { FileVariantKind, Prisma, StoredFile } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { sanitizePostgresText } from "../../storage/utils/sanitize-postgres-text.util";

const SCAN_RESULT_MAX_LENGTH = 500;

export interface CreateStoredFileInput {
	readonly id: string;
	readonly category: FileCategory;
	readonly visibility: "PUBLIC" | "PRIVATE";
	readonly originalName: string;
	readonly mimeType: string;
	readonly sizeBytes: number;
	readonly expectedChecksum: string;
	readonly storageBucket: string;
	readonly storagePath: string;
	readonly uploadedById: string;
	readonly merchantOrgId?: string;
}

export interface CreateFileVariantInput {
	readonly id: string;
	readonly fileId: string;
	readonly kind: FileVariantKind;
	readonly mimeType: string;
	readonly sizeBytes: number;
	readonly storageBucket: string;
	readonly storagePath: string;
	readonly publicPath?: string;
	readonly objectGeneration?: string | null;
}

@Injectable()
export class StoredFileRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async create(input: CreateStoredFileInput): Promise<StoredFile> {
		return this.prisma.storedFile.create({
			data: {
				id: input.id,
				category: input.category,
				visibility: input.visibility,
				originalName: input.originalName,
				mimeType: input.mimeType,
				sizeBytes: input.sizeBytes,
				expectedChecksum: input.expectedChecksum,
				storageBucket: input.storageBucket,
				storagePath: input.storagePath,
				uploadedById: input.uploadedById,
				merchantOrgId: input.merchantOrgId ?? null,
				status: "PENDING",
			},
		});
	}

	public async findById(id: string): Promise<StoredFile | null> {
		return this.prisma.storedFile.findFirst({
			where: { id, isDeleted: false },
		});
	}

	public async updateStatus(
		id: string,
		status: FileStatus,
		data?: Partial<{
			actualChecksum: string;
			objectGeneration: string | null;
			storagePath: string;
			publicPath: string | null;
			scanStatus: StoredObjectScanStatus;
			scannedAt: bigint;
			scanResult: string;
		}>,
	): Promise<StoredFile> {
		const scanResult = data?.scanResult !== undefined ? sanitizePostgresText(data.scanResult, SCAN_RESULT_MAX_LENGTH) : undefined;
		return this.prisma.storedFile.update({
			where: { id },
			data: {
				status,
				...data,
				scanResult,
			},
		});
	}

	public async markDeleted(id: string): Promise<StoredFile> {
		const now = BigInt(Date.now());
		return this.prisma.storedFile.update({
			where: { id },
			data: {
				status: "DELETED",
				isDeleted: true,
				deletedAt: now,
			},
		});
	}

	public async listStalePending(olderThanMs: number): Promise<StoredFile[]> {
		const cutoff = BigInt(Date.now() - olderThanMs);
		return this.prisma.storedFile.findMany({
			where: {
				status: "PENDING",
				isDeleted: false,
				createdAt: { lt: cutoff },
			},
			take: 100,
		});
	}

	public async createVariant(input: CreateFileVariantInput): Promise<void> {
		await this.prisma.fileVariant.create({
			data: {
				id: input.id,
				fileId: input.fileId,
				kind: input.kind,
				mimeType: input.mimeType,
				sizeBytes: input.sizeBytes,
				storageBucket: input.storageBucket,
				storagePath: input.storagePath,
				publicPath: input.publicPath ?? null,
				objectGeneration: input.objectGeneration ?? null,
			},
		});
	}

	public async createProductImage(productId: string, fileId: string, sortOrder: number, isPrimary: boolean): Promise<void> {
		await this.prisma.productImage.create({
			data: {
				id: randomUUID(),
				productId,
				fileId,
				sortOrder,
				isPrimary,
			},
		});
	}

	public async upsertMerchantAsset(merchantOrgId: string, assetType: "LOGO" | "BANNER", fileId: string): Promise<void> {
		await this.prisma.merchantAsset.upsert({
			where: { merchantOrgId_assetType: { merchantOrgId, assetType } },
			create: {
				id: randomUUID(),
				merchantOrgId,
				assetType,
				fileId,
			},
			update: {
				fileId,
				isDeleted: false,
				deletedAt: null,
			},
		});
	}

	public async upsertUserAvatar(userId: string, fileId: string): Promise<void> {
		await this.prisma.userAvatar.upsert({
			where: { userId },
			create: {
				id: randomUUID(),
				userId,
				fileId,
			},
			update: {
				fileId,
				isDeleted: false,
				deletedAt: null,
			},
		});
	}

	public async createMerchantKybFile(merchantOrgId: string, fileId: string, submissionId: string): Promise<void> {
		await this.prisma.merchantKybFile.create({
			data: {
				id: randomUUID(),
				merchantOrgId,
				fileId,
				submissionId,
				isActive: true,
			},
		});
	}

	public async deactivateMerchantKybFiles(merchantOrgId: string): Promise<readonly { fileId: string; storageBucket: string; storagePath: string }[]> {
		const active = await this.prisma.merchantKybFile.findMany({
			where: { merchantOrgId, isActive: true, isDeleted: false },
			include: { file: true },
		});
		if (active.length === 0) {
			return [];
		}
		await this.prisma.merchantKybFile.updateMany({
			where: { merchantOrgId, isActive: true, isDeleted: false },
			data: { isActive: false },
		});
		return active.map((row) => ({
			fileId: row.fileId,
			storageBucket: row.file.storageBucket,
			storagePath: row.file.storagePath,
		}));
	}

	public async listActiveMerchantKybFiles(merchantOrgId: string): Promise<Prisma.MerchantKybFileGetPayload<{ include: { file: true } }>[]> {
		return this.prisma.merchantKybFile.findMany({
			where: { merchantOrgId, isActive: true, isDeleted: false },
			include: { file: true },
			orderBy: { createdAt: "asc" },
		});
	}
}
