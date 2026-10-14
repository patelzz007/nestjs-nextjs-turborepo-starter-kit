// ============================================
// prisma/seed/stored-file-seed-writer.ts — writes seed files the way uploads do
// ============================================
// Shared by every seed that stores real bytes (file lifecycle, reward covers):
//   - the object bytes go through the CONFIGURED storage adapter (local disk,
//     S3 or Firebase — the same port uploads use), so every seeded file is
//     really downloadable and carries the provider's revision;
//   - the scan status comes from the CONFIGURED malware scanner: with
//     MALWARE_SCANNER=none files are READY + NOT_SCANNED, never CLEAN;
//   - public files (per the category's `FILE_CATEGORY_POLICIES` visibility)
//     carry the URL the provider's PublicDelivery returns;
//   - images whose category has pixel rules (reward images, avatars, logos) are
//     checked and rendered by the API's own ImageRenditionService: a seed image
//     that breaks its rules fails the seed, and every rendition is real and published;
//   - a deleted file was deleted by a user: the file AND every row that pointed
//     at it are soft-deleted with the same `deleted_by`, and the bytes (with its
//     renditions') removed.
// Every row is upserted on its id, so a re-run converges.

import type { Prisma } from "@prisma/client";
import { DAY_MS, getFileCategoryPolicy, type FileCategory, type StorageProvider } from "@workspace/shared";

import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { LocalTransferTokenService } from "../../src/modules/storage/adapters/local/local-transfer-token.service";
import { createMalwareScanner } from "../../src/modules/storage/adapters/scanners/malware-scanner.factory";
import type { MalwareScanner } from "../../src/modules/storage/domain/malware-scanner.port";
import { ImageRenditionService } from "../../src/modules/files/services/image-rendition.service";
import { SharpImageProcessor } from "../../src/modules/storage/adapters/images/sharp-image-processor";
import { createStorageAdapter, type StorageAdapter } from "../../src/modules/storage/factory/storage-adapter.factory";
import { buildFinalStoragePath } from "../../src/modules/storage/utils/file-path.util";
import { toStorageObjectLocator } from "../../src/modules/storage/utils/storage-locator.util";
import { prisma } from "./client";
import { sha256BytesHex } from "./helpers";

/** The categories seeds store bytes for. */
export type SeedFileCategory = Extract<FileCategory, "MERCHANT_KYB" | "PRODUCT_IMAGE" | "USER_AVATAR" | "STORE_LOGO" | "REWARD_IMAGE">;

/** The MIME types of the seed files on disk / in memory (each matches its magic bytes). */
export type SeedFileMimeType = "application/pdf" | "image/png" | "image/webp";

export interface SeedObject {
	readonly id: string;
	readonly category: SeedFileCategory;
	readonly ownerId: string;
	readonly fileName: string;
	readonly mimeType: SeedFileMimeType;
	readonly bytes: Buffer;
	readonly uploadedById: string;
	readonly organizationId: string | null;
	readonly uploadedDaysAgo: number;
}

export interface StoredSeedObject {
	readonly storagePath: string;
	readonly revision: string | null;
	readonly publicPath: string | null;
}

/** How the configured scanner clears a seeded file (seeds only ever hold usable demo files). */
interface SeedScanRecord {
	readonly scanStatus: "CLEAN" | "NOT_SCANNED";
	readonly scanResult: string;
}

export interface SeedFileWriter {
	readonly provider: StorageProvider;
	readonly container: string;
	readonly storage: StorageAdapter;
	readonly locatorFor: (path: string) => ReturnType<typeof toStorageObjectLocator>;
	/** Writes through the configured adapter; an unreachable or missing bucket fails with the fix, not a raw SDK error. */
	readonly uploadSeedObject: (input: Parameters<StorageAdapter["upload"]>[0]) => ReturnType<StorageAdapter["upload"]>;
	/** Stores the bytes, publishes public files, scans, and upserts the READY row. */
	readonly seedReadyFile: (object: SeedObject) => Promise<StoredSeedObject>;
	/** What DELETE /files/:id does: the file and every referencing row soft-deleted by `deletedBy`, then the bytes removed. */
	readonly deleteFile: (fileId: string, stored: StoredSeedObject, deletedBy: string, deletedDaysAgo: number) => Promise<void>;
}

function daysAgo(days: number): bigint {
	return BigInt(Date.now() - days * DAY_MS);
}

function assertNever(value: never): never {
	throw new Error(`Unhandled scan result: ${JSON.stringify(value)}`);
}

/** Asks the configured scanner, exactly as the upload pipeline does. */
async function scanRecordFor(
	scanner: MalwareScanner,
	object: SeedObject,
	storage: StorageAdapter,
	stored: StoredSeedObject,
	locatorFor: (path: string) => ReturnType<typeof toStorageObjectLocator>,
): Promise<SeedScanRecord> {
	const result = await scanner.scan({
		fileId: object.id,
		locator: locatorFor(stored.storagePath),
		openStream: async () => storage.getObjectStream(locatorFor(stored.storagePath)),
	});
	switch (result.outcome) {
		case "CLEAN":
			return { scanStatus: "CLEAN", scanResult: `${result.engine}: ${result.detail}` };
		case "NOT_SCANNED":
			return { scanStatus: "NOT_SCANNED", scanResult: `${result.engine}: ${result.reason}` };
		case "INFECTED":
		case "PENDING_EXTERNAL":
			throw new Error(`Seed demo file ${object.fileName} cannot be seeded as READY: the configured scanner answered ${result.outcome}`);
		default:
			return assertNever(result);
	}
}

/** The configured storage adapter and scanner, and the helpers that write seed files through them. */
export function createSeedFileWriter(): SeedFileWriter {
	const config = new TypedConfigService(getApiConfig());
	const provider = config.storage.provider;
	const container = config.storage.privateContainer;
	const storage = createStorageAdapter(config, new LocalTransferTokenService());
	const scanner = createMalwareScanner(config.storage.malwareScanner);
	const locatorFor = (path: string): ReturnType<typeof toStorageObjectLocator> => toStorageObjectLocator(provider, container, path);
	// Images with pixel rules go through the API's own checks and renditions (sharp), exactly as uploads do.
	const renditions = new ImageRenditionService(config, storage, storage, new SharpImageProcessor());

	const uploadSeedObject = async (input: Parameters<StorageAdapter["upload"]>[0]): ReturnType<StorageAdapter["upload"]> => {
		try {
			return await storage.upload(input);
		} catch (error) {
			throw new Error(
				`Seed could not write to STORAGE_PROVIDER=${provider} container "${container}" (${error instanceof Error ? error.message : "unknown error"}). ` +
					"Create the bucket / fix its credentials, or set STORAGE_PROVIDER=local in apps/api/.env for offline development.",
				{ cause: error },
			);
		}
	};

	const seedReadyFile = async (object: SeedObject): Promise<StoredSeedObject> => {
		const storagePath = buildFinalStoragePath({ category: object.category, ownerId: object.ownerId, fileId: object.id, fileName: object.fileName, mimeType: object.mimeType });
		const uploaded = await uploadSeedObject({ locator: locatorFor(storagePath), buffer: object.bytes, mimeType: object.mimeType });
		const isPublic = getFileCategoryPolicy(object.category).visibility === "PUBLIC";
		const publicPath = isPublic
			? (await storage.publishAsset({ locator: uploaded.locator, fileId: object.id, mimeType: object.mimeType, fileName: object.fileName })).publicUrl
			: null;
		const stored: StoredSeedObject = { storagePath, revision: uploaded.revision, publicPath };
		const dimensions = await renditions.inspectUpload({ category: object.category }, uploaded.locator);
		const scan = await scanRecordFor(scanner, object, storage, stored, locatorFor);
		const checksum = sha256BytesHex(object.bytes);
		const row = {
			id: object.id,
			category: object.category,
			visibility: isPublic ? "PUBLIC" : "PRIVATE",
			originalName: object.fileName,
			mimeType: object.mimeType,
			sizeBytes: object.bytes.length,
			expectedChecksum: checksum,
			actualChecksum: checksum,
			storageProvider: provider,
			storageContainer: container,
			storageBucket: container,
			storagePath,
			publicPath,
			objectRevision: uploaded.revision,
			objectGeneration: uploaded.revision,
			imageWidth: dimensions?.width ?? null,
			imageHeight: dimensions?.height ?? null,
			status: "READY",
			scanStatus: scan.scanStatus,
			scannedAt: daysAgo(object.uploadedDaysAgo),
			scanResult: scan.scanResult,
			uploadedById: object.uploadedById,
			organizationId: object.organizationId,
			productId: object.category === "PRODUCT_IMAGE" ? object.ownerId : null,
			createdAt: daysAgo(object.uploadedDaysAgo),
			updatedAt: daysAgo(object.uploadedDaysAgo),
			// A re-run restores the live state; a seed's delete step re-applies deletions.
			isDeleted: false,
			deletedAt: null,
			deletedBy: null,
		} satisfies Prisma.StoredFileUncheckedCreateInput;
		const file = await prisma.storedFile.upsert({ where: { id: object.id }, create: row, update: row });
		for (const variant of await renditions.renderAndPublish(file, uploaded.locator)) {
			const variantRow = { ...variant, fileId: file.id, isDeleted: false, deletedAt: null, deletedBy: null } satisfies Prisma.FileVariantUncheckedCreateInput;
			await prisma.fileVariant.upsert({ where: { fileId_kind: { fileId: file.id, kind: variant.kind } }, create: variantRow, update: variantRow });
		}
		return stored;
	};

	const deleteFile = async (fileId: string, stored: StoredSeedObject, deletedBy: string, deletedDaysAgo: number): Promise<void> => {
		const deletedAt = daysAgo(deletedDaysAgo);
		// Its renditions go with it, as `DELETE /files/:id` withdraws and removes them.
		const variants = await prisma.fileVariant.findMany({ where: { fileId, isDeleted: false }, select: { storagePath: true } });
		for (const variant of variants) {
			await storage.unpublishAsset({ locator: locatorFor(variant.storagePath), fileId });
			await storage.deleteObject(locatorFor(variant.storagePath));
		}
		const softDelete = { isDeleted: true, deletedAt, deletedBy, updatedAt: deletedAt };
		await prisma.storedFile.update({ where: { id: fileId }, data: { status: "DELETED", ...softDelete } });
		await prisma.productImage.updateMany({ where: { fileId }, data: { ...softDelete, isPrimary: false } });
		await prisma.organizationAsset.updateMany({ where: { fileId }, data: softDelete });
		await prisma.userAvatar.updateMany({ where: { fileId }, data: softDelete });
		await prisma.fileVariant.updateMany({ where: { fileId }, data: softDelete });
		await storage.deleteObject(locatorFor(stored.storagePath));
	};

	return { provider, container, storage, locatorFor, uploadSeedObject, seedReadyFile, deleteFile };
}
