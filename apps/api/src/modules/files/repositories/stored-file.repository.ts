import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { assertNever } from "@workspace/shared";
import type { FileCategory, FileStatus, StorageProvider, StoredObjectScanStatus } from "@workspace/shared";
import type { Prisma, PrismaClient, StoredFile } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { sanitizePostgresText } from "../../storage/utils/sanitize-postgres-text.util";

const SCAN_RESULT_MAX_LENGTH = 500;
/** Upper bound for one stale-file sweep page. */
const STALE_SWEEP_PAGE_SIZE = 100;

/** A Prisma client or an interactive-transaction client. */
export type StoredFileDbClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Statuses a file is in while a scan verdict is outstanding (`PROCESSING` is the pre-scanner legacy name). */
export const AWAITING_VERDICT_STATUSES: readonly FileStatus[] = ["SCANNING", "PROCESSING"];

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
	readonly organizationId?: string | undefined;
	readonly productId?: string | undefined;
}

export interface StoredFileStatusFields {
	readonly actualChecksum?: string;
	readonly objectGeneration?: string | null;
	readonly objectRevision?: string | null;
	readonly storagePath?: string;
	readonly publicPath?: string | null;
	readonly scanStatus?: StoredObjectScanStatus;
	readonly scannedAt?: bigint;
	readonly scanResult?: string;
}

/** Where a READY file is attached once its scan passes. */
export type StoredFileBinding =
	| { readonly kind: "PRODUCT_IMAGE"; readonly productId: string }
	| { readonly kind: "ORGANIZATION_ASSET"; readonly organizationId: string; readonly assetType: "LOGO" | "BANNER" }
	| { readonly kind: "USER_AVATAR"; readonly userId: string }
	| { readonly kind: "NONE" };

/** The binding target of a READY transition no longer exists (e.g. the product was removed mid-scan). */
export class StoredFileBindingTargetMissingError extends Error {
	public constructor(public readonly binding: StoredFileBinding) {
		super(`File binding target is missing: ${binding.kind}`);
		this.name = "StoredFileBindingTargetMissingError";
	}
}

/**
 * Persistence for stored files. Every state change is a conditional update
 * (`updateMany` on the expected current state) so concurrent requests, queue
 * redeliveries and replayed callbacks can never apply a transition twice or
 * resurrect a deleted/quarantined file; callers branch on the returned boolean.
 */
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
				productId: input.productId ?? null,
				status: "PENDING",
			},
		});
	}

	public async findById(id: string, db: StoredFileDbClient = this.prisma): Promise<StoredFile | null> {
		return db.storedFile.findFirst({
			where: { id, isDeleted: false },
		});
	}

	/** A live, READY, PUBLIC file — the only thing the local public-asset route may serve. */
	public async findReadyPublicById(id: string): Promise<StoredFile | null> {
		return this.prisma.storedFile.findFirst({
			where: { id, isDeleted: false, status: "READY", visibility: "PUBLIC" },
		});
	}

	/**
	 * PENDING → SCANNING for the uploader, exactly once. Two concurrent
	 * completions race on this row; only one sees `true`.
	 */
	public async claimPendingForScan(id: string, uploadedById: string, fields: StoredFileStatusFields): Promise<boolean> {
		const result = await this.prisma.storedFile.updateMany({
			where: { id, uploadedById, status: "PENDING", isDeleted: false },
			data: { ...this.statusData("SCANNING", { ...fields, scanStatus: "SCANNING" }) },
		});
		return result.count === 1;
	}

	/** Moves a live file from one of `from` to `to`; `false` when it was no longer in an expected state. */
	public async transitionStatus(
		id: string,
		from: readonly FileStatus[],
		to: FileStatus,
		fields: StoredFileStatusFields = {},
		db: StoredFileDbClient = this.prisma,
	): Promise<boolean> {
		const result = await db.storedFile.updateMany({
			where: { id, status: { in: [...from] }, isDeleted: false },
			data: this.statusData(to, fields),
		});
		return result.count === 1;
	}

	/**
	 * Soft-deletes a live file and every row that points at it, in one
	 * transaction, recording who deleted them. `false` when the file was already deleted.
	 */
	public async softDeleteWithReferences(id: string, deletedBy: string): Promise<boolean> {
		const deletedAt = BigInt(Date.now());
		const softDelete = { isDeleted: true, deletedAt, deletedBy, updatedAt: deletedAt };
		return this.prisma.$transaction(async (tx: StoredFileDbClient): Promise<boolean> => {
			const file = await tx.storedFile.updateMany({
				where: { id, isDeleted: false },
				data: { status: "DELETED", ...softDelete },
			});
			if (file.count !== 1) {
				return false;
			}
			await tx.productImage.updateMany({ where: { fileId: id, isDeleted: false }, data: { ...softDelete, isPrimary: false } });
			await tx.organizationAsset.updateMany({ where: { fileId: id, isDeleted: false }, data: softDelete });
			await tx.userAvatar.updateMany({ where: { fileId: id, isDeleted: false }, data: softDelete });
			await tx.organizationKybFile.updateMany({ where: { fileId: id, isDeleted: false }, data: { ...softDelete, isActive: false } });
			await tx.fileVariant.updateMany({ where: { fileId: id, isDeleted: false }, data: softDelete });
			return true;
		});
	}

	/** Soft-deletes an abandoned upload only while it is still PENDING (a completion racing the sweep wins). */
	public async softDeleteStalePending(id: string, deletedBy: string): Promise<boolean> {
		const deletedAt = BigInt(Date.now());
		const result = await this.prisma.storedFile.updateMany({
			where: { id, status: "PENDING", isDeleted: false },
			data: { status: "DELETED", isDeleted: true, deletedAt, deletedBy, updatedAt: deletedAt },
		});
		return result.count === 1;
	}

	public async listStalePending(olderThanMs: number): Promise<StoredFile[]> {
		return this.listOlderThan(["PENDING"], olderThanMs);
	}

	/** Files whose verdict is overdue (lost job, scanner outage beyond retries): the sweep re-dispatches them. */
	public async listStaleAwaitingVerdict(olderThanMs: number): Promise<StoredFile[]> {
		return this.listOlderThan(AWAITING_VERDICT_STATUSES, olderThanMs);
	}

	/** Whether this file was ever submitted as KYB evidence (submitted evidence is retained, never user-deletable). */
	public async hasKybSubmissionReference(fileId: string): Promise<boolean> {
		const reference = await this.prisma.organizationKybFile.findFirst({ where: { fileId }, select: { id: true } });
		return reference !== null;
	}

	public async createOrganizationKybFile(db: StoredFileDbClient, organizationId: string, fileId: string, submissionId: string): Promise<void> {
		await db.organizationKybFile.create({
			data: {
				id: randomUUID(),
				organizationId,
				fileId,
				submissionId,
				isActive: true,
			},
		});
	}

	/** Retires the active submission's evidence links (kept, never deleted: they are the review history). */
	public async deactivateOrganizationKybFiles(db: StoredFileDbClient, organizationId: string): Promise<void> {
		await db.organizationKybFile.updateMany({
			where: { organizationId, isActive: true, isDeleted: false },
			data: { isActive: false, updatedAt: BigInt(Date.now()) },
		});
	}

	public async listActiveOrganizationKybFiles(
		organizationId: string,
		db: StoredFileDbClient = this.prisma,
	): Promise<Prisma.OrganizationKybFileGetPayload<{ include: { file: true } }>[]> {
		return db.organizationKybFile.findMany({
			where: { organizationId, isActive: true, isDeleted: false },
			include: { file: true },
			orderBy: { createdAt: "asc" },
		});
	}

	/** Live MERCHANT_KYB files of `organizationId` uploaded by `uploadedById`, among `ids`. */
	public async findOwnKybUploads(organizationId: string, uploadedById: string, ids: readonly string[]): Promise<StoredFile[]> {
		return this.prisma.storedFile.findMany({
			where: { id: { in: [...ids] }, category: "MERCHANT_KYB", organizationId, uploadedById, isDeleted: false },
		});
	}

	public async findFilesByIds(db: StoredFileDbClient, ids: readonly string[]): Promise<StoredFile[]> {
		return db.storedFile.findMany({ where: { id: { in: [...ids] }, isDeleted: false } });
	}

	private async listOlderThan(statuses: readonly FileStatus[], olderThanMs: number): Promise<StoredFile[]> {
		const cutoff = BigInt(Date.now() - olderThanMs);
		return this.prisma.storedFile.findMany({
			where: { status: { in: [...statuses] }, isDeleted: false, updatedAt: { lt: cutoff } },
			orderBy: { updatedAt: "asc" },
			take: STALE_SWEEP_PAGE_SIZE,
		});
	}

	private statusData(status: FileStatus, fields: StoredFileStatusFields): Prisma.StoredFileUpdateManyMutationInput {
		const { scanResult, ...rest } = fields;
		return {
			status,
			...rest,
			updatedAt: BigInt(Date.now()),
			// Only touch the column when a scan result is supplied — always stored sanitized.
			...(scanResult === undefined ? {} : { scanResult: sanitizePostgresText(scanResult, SCAN_RESULT_MAX_LENGTH) }),
		};
	}

	/**
	 * Attaches a file to the resource it was uploaded for. Called inside the
	 * verdict transaction that marks it READY, so a file is never READY without
	 * its binding, nor bound while unscanned.
	 */
	public async bindInTx(tx: StoredFileDbClient, fileId: string, binding: StoredFileBinding): Promise<void> {
		switch (binding.kind) {
			case "PRODUCT_IMAGE":
				await this.bindProductImage(tx, fileId, binding);
				return;
			case "ORGANIZATION_ASSET":
				await tx.organizationAsset.upsert({
					where: { organizationId_assetType: { organizationId: binding.organizationId, assetType: binding.assetType } },
					create: { id: randomUUID(), organizationId: binding.organizationId, assetType: binding.assetType, fileId },
					update: { fileId, isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: BigInt(Date.now()) },
				});
				return;
			case "USER_AVATAR":
				await tx.userAvatar.upsert({
					where: { userId: binding.userId },
					create: { id: randomUUID(), userId: binding.userId, fileId },
					update: { fileId, isDeleted: false, deletedAt: null, deletedBy: null, updatedAt: BigInt(Date.now()) },
				});
				return;
			case "NONE":
				return;
			default:
				assertNever(binding, "file binding");
		}
	}

	/**
	 * Appends the image to the product's gallery. The product row is locked so
	 * concurrent uploads for one product serialize: exactly one becomes primary
	 * (only when the product has no live primary image) and sort orders never collide.
	 * The partial unique index `product_images_one_live_primary_key` backs this up.
	 */
	private async bindProductImage(tx: StoredFileDbClient, fileId: string, binding: Extract<StoredFileBinding, { kind: "PRODUCT_IMAGE" }>): Promise<void> {
		const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "product" WHERE id = ${binding.productId} AND deleted_at IS NULL FOR UPDATE`;
		if (locked.length === 0) {
			throw new StoredFileBindingTargetMissingError(binding);
		}
		const liveImages = await tx.productImage.findMany({
			where: { productId: binding.productId, isDeleted: false },
			select: { isPrimary: true, sortOrder: true },
		});
		const nextSortOrder = liveImages.reduce((highest: number, image: { sortOrder: number }): number => Math.max(highest, image.sortOrder + 1), 0);
		await tx.productImage.create({
			data: {
				id: randomUUID(),
				productId: binding.productId,
				fileId,
				sortOrder: nextSortOrder,
				isPrimary: !liveImages.some((image: { isPrimary: boolean }): boolean => image.isPrimary),
			},
		});
	}
}
