import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { FileCategory, FileStatus, StorageProvider, StoredObjectScanStatus } from "@workspace/shared";
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
	readonly storageProvider: StorageProvider;
	readonly storageContainer: string;
	readonly objectRevision?: string | null;
	readonly storageBucket: string;
	readonly storagePath: string;
	readonly uploadedById: string;
	readonly organizationId?: string;
}

export interface CreateFileVariantInput {
	readonly id: string;
	readonly fileId: string;
	readonly kind: FileVariantKind;
	readonly mimeType: string;
	readonly sizeBytes: number;
	readonly storageProvider: StorageProvider;
	readonly storageContainer: string;
	readonly storageBucket: string;
	readonly storagePath: string;
	readonly publicPath?: string;
	readonly objectRevision?: string | null;
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
				storageProvider: input.storageProvider,
				storageContainer: input.storageContainer,
				objectRevision: input.objectRevision ?? null,
				storageBucket: input.storageBucket,
				storagePath: input.storagePath,
				objectGeneration: input.objectRevision ?? null,
				uploadedById: input.uploadedById,
				organizationId: input.organizationId ?? null,
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
			objectRevision: string | null;
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
				storageProvider: input.storageProvider,
				storageContainer: input.storageContainer,
				storageBucket: input.storageBucket,
				storagePath: input.storagePath,
				publicPath: input.publicPath ?? null,
				objectRevision: input.objectRevision ?? null,
				objectGeneration: input.objectRevision ?? input.objectGeneration ?? null,
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

	public async upsertMerchantAsset(organizationId: string, assetType: "LOGO" | "BANNER", fileId: string): Promise<void> {
		await this.prisma.organizationAsset.upsert({
			where: { organizationId_assetType: { organizationId, assetType } },
			create: {
				id: randomUUID(),
				organizationId,
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

	public async createOrganizationKybFile(organizationId: string, fileId: string, submissionId: string): Promise<void> {
		await this.prisma.organizationKybFile.create({
			data: {
				id: randomUUID(),
				organizationId,
				fileId,
				submissionId,
				isActive: true,
			},
		});
	}

	public async deactivateOrganizationKybFiles(organizationId: string): Promise<readonly { fileId: string; storageBucket: string; storagePath: string }[]> {
		const active = await this.prisma.organizationKybFile.findMany({
			where: { organizationId, isActive: true, isDeleted: false },
			include: { file: true },
		});
		if (active.length === 0) {
			return [];
		}
		await this.prisma.organizationKybFile.updateMany({
			where: { organizationId, isActive: true, isDeleted: false },
			data: { isActive: false },
		});
		return active.map((row) => ({
			fileId: row.fileId,
			storageBucket: row.file.storageBucket,
			storagePath: row.file.storagePath,
		}));
	}

	public async listActiveOrganizationKybFiles(organizationId: string): Promise<Prisma.OrganizationKybFileGetPayload<{ include: { file: true } }>[]> {
		return this.prisma.organizationKybFile.findMany({
			where: { organizationId, isActive: true, isDeleted: false },
			include: { file: true },
			orderBy: { createdAt: "asc" },
		});
	}
}
