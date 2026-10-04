// ============================================
// prisma/seed/files.ts — file lifecycle demo data (development scenario)
// ============================================
// Every row is produced the way the application produces it (FileService /
// FileFinalizationService / StoredFileRepository):
//   - the object bytes go through the CONFIGURED storage adapter (local disk,
//     S3 or Firebase — the same port uploads use), so every seeded file is
//     really downloadable and carries the provider's revision;
//   - the scan status comes from the CONFIGURED malware scanner: with
//     MALWARE_SCANNER=none files are READY + NOT_SCANNED, never CLEAN;
//   - public files carry the URL the provider's PublicDelivery returns;
//   - a deleted file was deleted by a user: the file AND every row that pointed
//     at it are soft-deleted with the same `deleted_by`, and the bytes removed;
//   - Brew & Bean KL completed onboarding through its invite and submitted KYB
//     evidence twice: the first submission was retired (is_active = false) by
//     the second, and the second consumed the invite's document window
//     (`documents_submitted_at`). Submitted evidence is retained, never deleted.
// Idempotent: every row is upserted on a stable key; a re-run converges.

import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { sha256Hex } from "../../src/common/crypto/sha256";
import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { LocalTransferTokenService } from "../../src/modules/storage/adapters/local/local-transfer-token.service";
import { createMalwareScanner } from "../../src/modules/storage/adapters/scanners/malware-scanner.factory";
import type { MalwareScanner } from "../../src/modules/storage/domain/malware-scanner.port";
import { createStorageAdapter, type StorageAdapter } from "../../src/modules/storage/factory/storage-adapter.factory";
import { buildFinalStoragePath, buildPublicVariantPath } from "../../src/modules/storage/utils/file-path.util";
import { toStorageObjectLocator } from "../../src/modules/storage/utils/storage-locator.util";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { ORGANIZATION_SEED_IDS } from "./organizations";
import { buildProductSeedId } from "./products";
import { requireRow } from "./require-row";

const NAMESPACE = "file-seed";
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

export const FILE_SEED_IDS = Object.freeze({
	klOnboardingInvitation: deterministicUuid(NAMESPACE, "kl-onboarding-invitation"),
	klKybFirstScan: deterministicUuid(NAMESPACE, "kl-kyb-ssm-scan-first-submission"),
	klKybFirstSubmission: deterministicUuid(NAMESPACE, "kl-kyb-submission-1"),
	klKybFirstLink: deterministicUuid(NAMESPACE, "kl-kyb-link-1"),
	klKybLicence: deterministicUuid(NAMESPACE, "kl-kyb-business-licence"),
	klKybSecondSubmission: deterministicUuid(NAMESPACE, "kl-kyb-submission-2"),
	klKybSecondLink: deterministicUuid(NAMESPACE, "kl-kyb-link-2"),
	productImage: deterministicUuid(NAMESPACE, "product-001-image"),
	productImageRow: deterministicUuid(NAMESPACE, "product-001-image-row"),
	deletedProductImage: deterministicUuid(NAMESPACE, "product-001-deleted-image"),
	deletedProductImageRow: deterministicUuid(NAMESPACE, "product-001-deleted-image-row"),
	deletedAvatar: deterministicUuid(NAMESPACE, "kl-owner-deleted-avatar"),
	deletedAvatarRow: deterministicUuid(NAMESPACE, "kl-owner-deleted-avatar-row"),
	deletedAvatarThumbnail: deterministicUuid(NAMESPACE, "kl-owner-deleted-avatar-thumbnail"),
	deletedLogo: deterministicUuid(NAMESPACE, "kl-deleted-logo"),
	deletedLogoAsset: deterministicUuid(NAMESPACE, "kl-deleted-logo-asset"),
});

/** Smallest well-formed documents whose magic bytes match their declared type. */
const PDF_BYTES: Buffer = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "latin1");
const PNG_BYTES: Buffer = Buffer.from(
	"89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
	"hex",
);

export interface FileSeedSummary {
	readonly files: number;
	readonly provider: string;
}

type SeedCategory = "MERCHANT_KYB" | "PRODUCT_IMAGE" | "USER_AVATAR" | "STORE_LOGO";

interface SeedObject {
	readonly id: string;
	readonly category: SeedCategory;
	readonly ownerId: string;
	readonly fileName: string;
	readonly mimeType: "application/pdf" | "image/png";
	readonly bytes: Buffer;
	readonly uploadedById: string;
	readonly organizationId: string | null;
	readonly uploadedDaysAgo: number;
}

interface StoredSeedObject {
	readonly storagePath: string;
	readonly revision: string | null;
	readonly publicPath: string | null;
}

/** How the configured scanner clears a seeded file (seeds only ever hold usable demo files). */
interface SeedScanRecord {
	readonly scanStatus: "CLEAN" | "NOT_SCANNED";
	readonly scanResult: string;
}

function daysAgo(days: number): bigint {
	return BigInt(Date.now() - days * MS_PER_DAY);
}

function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
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

function assertNever(value: never): never {
	throw new Error(`Unhandled scan result: ${JSON.stringify(value)}`);
}

export async function seedFileLifecycle(): Promise<FileSeedSummary> {
	const config = new TypedConfigService(getApiConfig());
	const provider = config.storageProvider;
	const container = config.storagePrivateBucket;
	const storage = createStorageAdapter(config, new LocalTransferTokenService());
	const scanner = createMalwareScanner(config.malwareScanner);
	const locatorFor = (path: string): ReturnType<typeof toStorageObjectLocator> => toStorageObjectLocator(provider, container, path);
	/** Writes through the configured adapter; an unreachable or missing bucket fails with the fix, not a raw SDK error. */
	const uploadSeedObject = async (input: Parameters<StorageAdapter["upload"]>[0]): ReturnType<StorageAdapter["upload"]> => {
		try {
			return await storage.upload(input);
		} catch (error) {
			throw new Error(
				`File seed could not write to STORAGE_PROVIDER=${provider} container "${container}" (${error instanceof Error ? error.message : "unknown error"}). ` +
					"Create the bucket / fix its credentials, or set STORAGE_PROVIDER=local in apps/api/.env for offline development.",
				{ cause: error },
			);
		}
	};

	const klOwnerMembership = requireRow(
		(await prisma.organizationMembership.findUnique({ where: { id: ORGANIZATION_SEED_IDS.klOwnerMembership }, include: { user: true } })) ?? undefined,
		"Brew & Bean KL owner membership",
	);
	const klOwner = klOwnerMembership.user;
	const klOrganizationId = ORGANIZATION_SEED_IDS.klOrganization;
	// Demo Product 001 (product seed ids are 1-based).
	const productId = buildProductSeedId(1);
	const admin = requireRow((await prisma.user.findUnique({ where: { email: "admin@example.com" } })) ?? undefined, "user admin@example.com");

	/** Stores the bytes, publishes public files, scans, and upserts the READY row. */
	const seedReadyFile = async (object: SeedObject): Promise<StoredSeedObject> => {
		const storagePath = buildFinalStoragePath({ category: object.category, ownerId: object.ownerId, fileId: object.id, fileName: object.fileName, mimeType: object.mimeType });
		const uploaded = await uploadSeedObject({ locator: locatorFor(storagePath), buffer: object.bytes, mimeType: object.mimeType });
		const isPublic = object.category !== "MERCHANT_KYB";
		const publicPath = isPublic
			? (await storage.publishAsset({ locator: uploaded.locator, fileId: object.id, mimeType: object.mimeType, fileName: object.fileName })).publicUrl
			: null;
		const stored: StoredSeedObject = { storagePath, revision: uploaded.revision, publicPath };
		const scan = await scanRecordFor(scanner, object, storage, stored, locatorFor);
		const checksum = sha256(object.bytes);
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
			status: "READY",
			scanStatus: scan.scanStatus,
			scannedAt: daysAgo(object.uploadedDaysAgo),
			scanResult: scan.scanResult,
			uploadedById: object.uploadedById,
			organizationId: object.organizationId,
			productId: object.category === "PRODUCT_IMAGE" ? object.ownerId : null,
			createdAt: daysAgo(object.uploadedDaysAgo),
			updatedAt: daysAgo(object.uploadedDaysAgo),
			// A re-run restores the live state; the delete step below re-applies deletions.
			isDeleted: false,
			deletedAt: null,
			deletedBy: null,
		} satisfies Prisma.StoredFileUncheckedCreateInput;
		await prisma.storedFile.upsert({ where: { id: object.id }, create: row, update: row });
		return stored;
	};

	/** What DELETE /files/:id does: the file and every referencing row soft-deleted by `deletedBy`, then the bytes removed. */
	const deleteFile = async (fileId: string, stored: StoredSeedObject, deletedBy: string, deletedDaysAgo: number): Promise<void> => {
		const deletedAt = daysAgo(deletedDaysAgo);
		const softDelete = { isDeleted: true, deletedAt, deletedBy, updatedAt: deletedAt };
		await prisma.storedFile.update({ where: { id: fileId }, data: { status: "DELETED", ...softDelete } });
		await prisma.productImage.updateMany({ where: { fileId }, data: { ...softDelete, isPrimary: false } });
		await prisma.organizationAsset.updateMany({ where: { fileId }, data: softDelete });
		await prisma.userAvatar.updateMany({ where: { fileId }, data: softDelete });
		await prisma.fileVariant.updateMany({ where: { fileId }, data: softDelete });
		await storage.deleteObject(locatorFor(stored.storagePath));
	};

	// ── Onboarding: invite accepted, KYB evidence submitted twice (window consumed by the second), review approved ──
	const acceptedAt = daysAgo(20);
	const invitation = {
		id: FILE_SEED_IDS.klOnboardingInvitation,
		organizationId: klOrganizationId,
		email: klOwner.email,
		// The plaintext token is never stored and is not needed again: the invite is used up.
		tokenHash: sha256Hex(`seed_invite_token_kl_onboarding_${FILE_SEED_IDS.klOnboardingInvitation}`),
		kind: "PLATFORM_ONBOARDING",
		intendedRole: "OWNER",
		locationScopeType: "ALL_LOCATIONS",
		status: "ACCEPTED",
		createdByAdminId: admin.id,
		acceptedByUserId: klOwner.id,
		acceptedAt,
		documentsSubmittedAt: acceptedAt + BigInt(2 * MS_PER_HOUR),
		expiresAt: acceptedAt + BigInt(5 * MS_PER_DAY),
		createdAt: daysAgo(22),
		updatedAt: acceptedAt + BigInt(2 * MS_PER_HOUR),
	} satisfies Prisma.OrganizationInvitationUncheckedCreateInput;
	await prisma.organizationInvitation.upsert({ where: { tokenHash: invitation.tokenHash }, create: invitation, update: invitation });

	const kybObject = (id: string, fileName: string, uploadedDaysAgo: number): SeedObject => ({
		id,
		category: "MERCHANT_KYB",
		ownerId: klOrganizationId,
		fileName,
		mimeType: "application/pdf",
		bytes: PDF_BYTES,
		uploadedById: klOwner.id,
		organizationId: klOrganizationId,
		uploadedDaysAgo,
	});
	await seedReadyFile(kybObject(FILE_SEED_IDS.klKybFirstScan, "brew-bean-ssm-certificate-scan.pdf", 21));
	await seedReadyFile(kybObject(FILE_SEED_IDS.klKybLicence, "brew-bean-business-licence.pdf", 20));
	// Submission 1 was retired (kept as review history) when submission 2 replaced it.
	const firstLink = {
		id: FILE_SEED_IDS.klKybFirstLink,
		organizationId: klOrganizationId,
		fileId: FILE_SEED_IDS.klKybFirstScan,
		submissionId: FILE_SEED_IDS.klKybFirstSubmission,
		isActive: false,
	};
	const secondLink = {
		id: FILE_SEED_IDS.klKybSecondLink,
		organizationId: klOrganizationId,
		fileId: FILE_SEED_IDS.klKybLicence,
		submissionId: FILE_SEED_IDS.klKybSecondSubmission,
		isActive: true,
	};
	for (const link of [firstLink, secondLink]) {
		await prisma.organizationKybFile.upsert({ where: { id: link.id }, create: link, update: link });
	}

	// ── Product gallery: a live primary image, and a second image the admin deleted ──
	const productObject = (id: string, fileName: string, uploadedDaysAgo: number): SeedObject => ({
		id,
		category: "PRODUCT_IMAGE",
		ownerId: productId,
		fileName,
		mimeType: "image/png",
		bytes: PNG_BYTES,
		uploadedById: admin.id,
		organizationId: null,
		uploadedDaysAgo,
	});
	await seedReadyFile(productObject(FILE_SEED_IDS.productImage, "demo-product-001.png", 10));
	const primaryImage = {
		id: FILE_SEED_IDS.productImageRow,
		productId,
		fileId: FILE_SEED_IDS.productImage,
		sortOrder: 0,
		isPrimary: true,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
	};
	await prisma.productImage.upsert({ where: { id: primaryImage.id }, create: primaryImage, update: primaryImage });
	const deletedProductImage = await seedReadyFile(productObject(FILE_SEED_IDS.deletedProductImage, "demo-product-001-alt.png", 9));
	const secondImage = {
		id: FILE_SEED_IDS.deletedProductImageRow,
		productId,
		fileId: FILE_SEED_IDS.deletedProductImage,
		sortOrder: 1,
		isPrimary: false,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
	};
	await prisma.productImage.upsert({ where: { id: secondImage.id }, create: secondImage, update: secondImage });
	await deleteFile(FILE_SEED_IDS.deletedProductImage, deletedProductImage, admin.id, 4);

	// ── Deleted by their owner: an avatar (with its thumbnail variant) and a store logo ──
	const avatar = await seedReadyFile({
		id: FILE_SEED_IDS.deletedAvatar,
		category: "USER_AVATAR",
		ownerId: klOwner.id,
		fileName: "old-avatar.png",
		mimeType: "image/png",
		bytes: PNG_BYTES,
		uploadedById: klOwner.id,
		organizationId: null,
		uploadedDaysAgo: 15,
	});
	const avatarRow = { id: FILE_SEED_IDS.deletedAvatarRow, userId: klOwner.id, fileId: FILE_SEED_IDS.deletedAvatar, isDeleted: false, deletedAt: null, deletedBy: null };
	await prisma.userAvatar.upsert({ where: { userId: klOwner.id }, create: avatarRow, update: avatarRow });
	const thumbnailPath = buildPublicVariantPath({
		category: "USER_AVATAR",
		ownerId: klOwner.id,
		fileId: FILE_SEED_IDS.deletedAvatar,
		fileName: "old-avatar.png",
		mimeType: "image/png",
		variant: "THUMBNAIL",
	});
	const thumbnail = await uploadSeedObject({ locator: locatorFor(thumbnailPath), buffer: PNG_BYTES, mimeType: "image/png" });
	const thumbnailPublished = await storage.publishAsset({
		locator: thumbnail.locator,
		fileId: FILE_SEED_IDS.deletedAvatar,
		mimeType: "image/png",
		fileName: "old-avatar-thumbnail.png",
	});
	const thumbnailRow = {
		id: FILE_SEED_IDS.deletedAvatarThumbnail,
		fileId: FILE_SEED_IDS.deletedAvatar,
		kind: "THUMBNAIL",
		mimeType: "image/png",
		sizeBytes: PNG_BYTES.length,
		storageProvider: provider,
		storageContainer: container,
		storageBucket: container,
		storagePath: thumbnailPath,
		publicPath: thumbnailPublished.publicUrl,
		objectRevision: thumbnail.revision,
		objectGeneration: thumbnail.revision,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
	} satisfies Prisma.FileVariantUncheckedCreateInput;
	await prisma.fileVariant.upsert({ where: { fileId_kind: { fileId: thumbnailRow.fileId, kind: thumbnailRow.kind } }, create: thumbnailRow, update: thumbnailRow });
	await deleteFile(FILE_SEED_IDS.deletedAvatar, avatar, klOwner.id, 3);
	await storage.deleteObject(locatorFor(thumbnailPath));

	const logo = await seedReadyFile({
		id: FILE_SEED_IDS.deletedLogo,
		category: "STORE_LOGO",
		ownerId: klOrganizationId,
		fileName: "old-logo.png",
		mimeType: "image/png",
		bytes: PNG_BYTES,
		uploadedById: klOwner.id,
		organizationId: klOrganizationId,
		uploadedDaysAgo: 15,
	});
	const logoAsset = {
		id: FILE_SEED_IDS.deletedLogoAsset,
		organizationId: klOrganizationId,
		assetType: "LOGO",
		fileId: FILE_SEED_IDS.deletedLogo,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
	} satisfies Prisma.OrganizationAssetUncheckedCreateInput;
	await prisma.organizationAsset.upsert({
		where: { organizationId_assetType: { organizationId: klOrganizationId, assetType: "LOGO" } },
		create: logoAsset,
		update: logoAsset,
	});
	await deleteFile(FILE_SEED_IDS.deletedLogo, logo, klOwner.id, 3);

	const files = await prisma.storedFile.count({ where: { id: { in: Object.values(FILE_SEED_IDS) } } });
	return { files, provider };
}
