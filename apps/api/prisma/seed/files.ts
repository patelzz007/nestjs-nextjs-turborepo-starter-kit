// ============================================
// prisma/seed/files.ts — file lifecycle demo data (development scenario)
// ============================================
// Every row is produced the way the application produces it (FileService /
// FileFinalizationService / StoredFileRepository) — see stored-file-seed-writer.ts
// for how bytes, scan status and public URLs are written;
//   - Brew & Bean KL completed onboarding through its invite and submitted KYB
//     evidence twice: the first submission was retired (is_active = false) by
//     the second, and the second consumed the invite's document window
//     (`documents_submitted_at`). Submitted evidence is retained, never deleted.
// Idempotent: every row is upserted on a stable key; a re-run converges.

import type { Prisma } from "@prisma/client";
import { DAY_MS } from "@workspace/shared";
import sharp from "sharp";

import { sha256Hex } from "../../src/common/crypto/sha256";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { ORGANIZATION_SEED_IDS } from "./organizations";
import { buildProductSeedId } from "./products";
import { requireRow } from "./require-row";
import { createSeedFileWriter, type SeedObject } from "./stored-file-seed-writer";

const NAMESPACE = "file-seed";
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
	deletedLogo: deterministicUuid(NAMESPACE, "kl-deleted-logo"),
	deletedLogoAsset: deterministicUuid(NAMESPACE, "kl-deleted-logo-asset"),
});

/** Smallest well-formed documents whose magic bytes match their declared type. */
const PDF_BYTES: Buffer = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n", "latin1");
const PNG_BYTES: Buffer = Buffer.from(
	"89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
	"hex",
);

/** Side of the seeded avatar and logo: square and above the 256 px minimum of their image rules. */
const SEED_SQUARE_IMAGE_SIDE = 512;

/** A plain square PNG that meets the avatar and logo rules, so it is checked and rendered like an upload. */
function squareImagePng(): Promise<Buffer> {
	return sharp({ create: { width: SEED_SQUARE_IMAGE_SIDE, height: SEED_SQUARE_IMAGE_SIDE, channels: 3, background: { r: 0, g: 122, b: 77 } } })
		.png()
		.toBuffer();
}

function daysAgo(days: number): bigint {
	return BigInt(Date.now() - days * DAY_MS);
}

export interface FileSeedSummary {
	readonly files: number;
	readonly provider: string;
}

export async function seedFileLifecycle(): Promise<FileSeedSummary> {
	const { provider, seedReadyFile, deleteFile } = createSeedFileWriter();
	const squarePng = await squareImagePng();

	const klOwnerMembership = requireRow(
		(await prisma.organizationMembership.findUnique({ where: { id: ORGANIZATION_SEED_IDS.klOwnerMembership }, include: { user: true } })) ?? undefined,
		"Brew & Bean KL owner membership",
	);
	const klOwner = klOwnerMembership.user;
	const klOrganizationId = ORGANIZATION_SEED_IDS.klOrganization;
	// Demo Product 001 (product seed ids are 1-based).
	const productId = buildProductSeedId(1);
	const admin = requireRow((await prisma.user.findUnique({ where: { email: "admin@example.com" } })) ?? undefined, "user admin@example.com");

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
		expiresAt: acceptedAt + BigInt(5 * DAY_MS),
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

	// ── Deleted by their owner: an avatar (with its renditions) and a store logo ──
	const avatar = await seedReadyFile({
		id: FILE_SEED_IDS.deletedAvatar,
		category: "USER_AVATAR",
		ownerId: klOwner.id,
		fileName: "old-avatar.png",
		mimeType: "image/png",
		bytes: squarePng,
		uploadedById: klOwner.id,
		organizationId: null,
		uploadedDaysAgo: 15,
	});
	const avatarRow = { id: FILE_SEED_IDS.deletedAvatarRow, userId: klOwner.id, fileId: FILE_SEED_IDS.deletedAvatar, isDeleted: false, deletedAt: null, deletedBy: null };
	await prisma.userAvatar.upsert({ where: { userId: klOwner.id }, create: avatarRow, update: avatarRow });
	await deleteFile(FILE_SEED_IDS.deletedAvatar, avatar, klOwner.id, 3);

	const logo = await seedReadyFile({
		id: FILE_SEED_IDS.deletedLogo,
		category: "STORE_LOGO",
		ownerId: klOrganizationId,
		fileName: "old-logo.png",
		mimeType: "image/png",
		bytes: squarePng,
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
