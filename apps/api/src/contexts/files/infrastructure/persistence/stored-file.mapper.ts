import type { FileVariant, PrismaClient, StoredFile } from "@prisma/client";
import {
	DocumentMimeTypeSchema,
	EpochMsSchema,
	FileRecordSchema,
	StorageObjectLocatorSchema,
	StorageProviderSchema,
	type FileRecord,
	type StorageObjectLocator,
} from "@workspace/shared";

import { resolveStoredPublicUrl } from "../../../../config/public-url.resolver";
import { inferStorageProviderFromContainer } from "../../../../platform/infrastructure/storage/utils/storage-locator.util";
import { StoredFileAggregate, type StoredFileObject } from "../../domain/aggregates/stored-file.aggregate";
import type { StoredFileView } from "../../application/ports/stored-file-read.port";

/** A Prisma client or an interactive-transaction client. */
export type StoredFileDbClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** The row columns that say where a stored copy lives (`StoredFile` and `FileVariant` share them). */
type LocatedRow = Pick<StoredFile, "storageProvider" | "storageContainer" | "storageBucket" | "storagePath" | "objectRevision" | "objectGeneration">;

/**
 * Where a stored copy lives: neutral columns first, then the legacy
 * bucket/generation fields. It does not check the active provider — that is
 * the storage adapter's job when an operation actually touches the object, so
 * reading metadata of a file stored elsewhere still works.
 */
export function storedLocatorOf(row: LocatedRow): StorageObjectLocator {
	const container = row.storageContainer ?? row.storageBucket;
	return StorageObjectLocatorSchema.parse({
		provider: StorageProviderSchema.parse(row.storageProvider ?? inferStorageProviderFromContainer(container)),
		container,
		path: row.storagePath,
		revision: row.objectRevision ?? row.objectGeneration ?? null,
	});
}

function originalOf(row: StoredFile): StoredFileObject {
	return { slot: "ORIGINAL", locator: storedLocatorOf(row), publicPath: row.publicPath };
}

function renditionOf(variant: FileVariant): StoredFileObject {
	return { slot: variant.kind, locator: storedLocatorOf(variant), publicPath: variant.publicPath };
}

/** Row → aggregate. A row that breaks an invariant throws `CorruptAggregateStateError` (never a silently invalid aggregate). */
export function toStoredFileAggregate(row: StoredFile, variants: readonly FileVariant[] = []): StoredFileAggregate {
	return StoredFileAggregate.rehydrate({
		id: row.id,
		category: row.category,
		visibility: row.visibility,
		status: row.status,
		isDeleted: row.isDeleted,
		uploadedById: row.uploadedById,
		tenantId: row.tenantId,
		productId: row.productId,
		expectedChecksum: row.expectedChecksum,
		original: originalOf(row),
		renditions: variants.map(renditionOf),
	});
}

/** Row → the public `FileRecord` contract, its public path resolved against the API's public address. */
export function toFileRecord(row: StoredFile, publicBaseUrl: string): FileRecord {
	return FileRecordSchema.parse({
		id: row.id,
		category: row.category,
		visibility: row.visibility,
		originalName: row.originalName,
		mimeType: DocumentMimeTypeSchema.parse(row.mimeType),
		sizeBytes: row.sizeBytes,
		status: row.status,
		scanStatus: row.scanStatus,
		publicUrl: resolveStoredPublicUrl(row.publicPath, publicBaseUrl),
		uploadedAt: EpochMsSchema.parse(Number(row.createdAt)),
	});
}

/** Row → the read view the files use cases work with. */
export function toStoredFileView(row: StoredFile, publicBaseUrl: string): StoredFileView {
	return {
		id: row.id,
		category: row.category,
		visibility: row.visibility,
		status: row.status,
		uploadedById: row.uploadedById,
		tenantId: row.tenantId,
		productId: row.productId,
		originalName: row.originalName,
		mimeType: row.mimeType,
		sizeBytes: row.sizeBytes,
		expectedChecksum: row.expectedChecksum,
		locator: storedLocatorOf(row),
		publicPath: row.publicPath,
		updatedAt: Number(row.updatedAt),
		record: toFileRecord(row, publicBaseUrl),
	};
}
