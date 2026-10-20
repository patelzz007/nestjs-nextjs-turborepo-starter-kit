import type { Prisma } from "@prisma/client";

import { assertNever } from "@workspace/shared";

import { legacyBucketFieldsFromLocator } from "../../../../platform/infrastructure/storage/utils/storage-locator.util";
import { sanitizePostgresText } from "../../../../platform/infrastructure/storage/utils/sanitize-postgres-text.util";
import type { FileRenditionRecord, StoredFileAggregate, VerdictRecord, VerifiedUpload } from "../../domain/aggregates/stored-file.aggregate";
import type { StoredFileRepository, StoredFileSaveOutcome } from "../../domain/repositories/stored-file.repository";
import { toStoredFileAggregate, type StoredFileDbClient } from "./stored-file.mapper";

/** `StoredFile.scanResult` is bounded so one huge scanner message cannot bloat the row. */
const SCAN_RESULT_MAX_LENGTH = 500;

/**
 * StoredFile aggregate persistence, bound to one transaction (or, for
 * `StoredFileAccess` upload requests, to the caller's existing session). Every save is a
 * conditional update on the status the aggregate was loaded in, so concurrent
 * requests, queue redeliveries and replayed callbacks never apply a transition
 * twice; the result says whether this writer won.
 */
export class PrismaStoredFileRepository implements StoredFileRepository {
	public constructor(private readonly db: StoredFileDbClient) {}

	public async add(file: StoredFileAggregate): Promise<void> {
		const change = file.pendingChange;
		if (change.kind !== "requested") {
			throw new Error(`StoredFileRepository.add expects a newly requested file, got "${change.kind}"`);
		}
		// createMany: a plain INSERT with no RETURNING, so it needs only the row's own WITH CHECK under the caller's RLS session.
		const inserted = await this.db.storedFile.createMany({
			data: [
				{
					id: file.id,
					category: file.category,
					visibility: file.visibility,
					originalName: change.upload.originalName,
					mimeType: change.upload.mimeType,
					sizeBytes: change.upload.sizeBytes,
					expectedChecksum: change.upload.expectedChecksum,
					...legacyBucketFieldsFromLocator(file.original.locator),
					storagePath: file.original.locator.path,
					uploadedById: file.uploadedById,
					tenantId: file.tenantId,
					productId: file.productId,
					status: "PENDING",
				},
			],
		});
		if (inserted.count !== 1) {
			throw new Error(`Stored file ${file.id} was not inserted`);
		}
	}

	public async findLive(fileId: string): Promise<StoredFileAggregate | null> {
		const row = await this.db.storedFile.findFirst({ where: { id: fileId, isDeleted: false } });
		return row === null ? null : toStoredFileAggregate(row);
	}

	public async lockForDeletion(fileId: string): Promise<StoredFileAggregate | null> {
		// Reward saves lock the same row (`lockUsableRewardImages`), so a save and a delete never interleave.
		await this.db.$queryRaw`SELECT id FROM "StoredFile" WHERE id = ${fileId} FOR UPDATE`;
		const row = await this.db.storedFile.findFirst({ where: { id: fileId, isDeleted: false } });
		if (row === null) {
			return null;
		}
		// Read inside the locked transaction: the renditions withdrawn and purged are exactly the ones deleted.
		const variants = await this.db.fileVariant.findMany({ where: { fileId, isDeleted: false } });
		return toStoredFileAggregate(row, variants);
	}

	public async save(file: StoredFileAggregate): Promise<StoredFileSaveOutcome> {
		const change = file.pendingChange;
		const loaded = file.concurrencyToken;
		if (loaded === null) {
			throw new Error(`Stored file ${file.id} is not persisted yet; use add()`);
		}
		const now = BigInt(Date.now());
		switch (change.kind) {
			case "none":
			case "requested":
				throw new Error(`Stored file ${file.id} has no change to save ("${change.kind}")`);
			case "claimed-for-scan":
				return this.applied(
					await this.db.storedFile.updateMany({
						where: { id: file.id, uploadedById: file.uploadedById, status: loaded, isDeleted: false },
						data: { status: "SCANNING", scanStatus: "SCANNING", ...verifiedFields(change.verified), updatedAt: now },
					}),
				);
			case "verdict": {
				const outcome = this.applied(
					await this.db.storedFile.updateMany({
						where: { id: file.id, status: loaded, isDeleted: false },
						data: { status: change.outcome, ...verdictFields(change.record), updatedAt: now },
					}),
				);
				if (outcome === "applied") {
					await this.recordRenditions(file.id, change.record.renditions);
				}
				return outcome;
			}
			case "deleted": {
				const softDelete = { isDeleted: true, deletedAt: BigInt(change.deletedAt), deletedBy: change.deletedBy, updatedAt: now };
				const outcome = this.applied(
					await this.db.storedFile.updateMany({ where: { id: file.id, status: loaded, isDeleted: false }, data: { status: "DELETED", ...softDelete } }),
				);
				if (outcome === "applied") {
					await this.db.fileVariant.updateMany({ where: { fileId: file.id, isDeleted: false }, data: softDelete });
				}
				return outcome;
			}
			default:
				return assertNever(change, "stored file change");
		}
	}

	/** READY and its renditions commit together; a re-run replaces earlier rows per kind. */
	private async recordRenditions(fileId: string, renditions: readonly FileRenditionRecord[]): Promise<void> {
		for (const rendition of renditions) {
			const row = fileVariantRowOf(fileId, rendition);
			await this.db.fileVariant.upsert({ where: { fileId_kind: { fileId, kind: rendition.kind } }, create: row, update: row });
		}
	}

	private applied(result: { readonly count: number }): StoredFileSaveOutcome {
		return result.count === 1 ? "applied" : "lost-race";
	}
}

/** One `FileVariant` row for a rendition (live). Also used by the seed writer, which records renditions the same way. */
export function fileVariantRowOf(fileId: string, rendition: FileRenditionRecord): Prisma.FileVariantUncheckedCreateInput {
	return {
		kind: rendition.kind,
		mimeType: rendition.mimeType,
		sizeBytes: rendition.sizeBytes,
		width: rendition.width,
		height: rendition.height,
		...legacyBucketFieldsFromLocator(rendition.locator),
		storagePath: rendition.locator.path,
		publicPath: rendition.publicPath,
		objectRevision: rendition.objectRevision,
		objectGeneration: rendition.objectRevision,
		fileId,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
	};
}

function verifiedFields(verified: VerifiedUpload): Prisma.StoredFileUpdateManyMutationInput {
	return {
		actualChecksum: verified.actualChecksum,
		objectGeneration: verified.objectRevision,
		objectRevision: verified.objectRevision,
		...(verified.imageWidth === null || verified.imageHeight === null ? {} : { imageWidth: verified.imageWidth, imageHeight: verified.imageHeight }),
	};
}

function verdictFields(record: VerdictRecord): Prisma.StoredFileUpdateManyMutationInput {
	return {
		// Always stored sanitized; only the columns this verdict reports are touched.
		scanResult: sanitizePostgresText(record.scanResult, SCAN_RESULT_MAX_LENGTH),
		...(record.scanStatus === null ? {} : { scanStatus: record.scanStatus }),
		...(record.scannedAt === null ? {} : { scannedAt: BigInt(record.scannedAt) }),
		...(record.promoted === null
			? {}
			: {
					storagePath: record.promoted.storagePath,
					objectGeneration: record.promoted.objectRevision,
					objectRevision: record.promoted.objectRevision,
					publicPath: record.promoted.publicPath,
				}),
	};
}
