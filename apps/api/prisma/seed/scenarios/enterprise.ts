import type { Prisma, Role, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { seedRewardHubTenantPolicies } from "../../../src/modules/organization/utils/rewardhub-policy-seed.util";
import { prisma } from "../client";
import {
	buildEnterpriseDataset,
	ENTERPRISE_DATASET_SIZES,
	ENTERPRISE_OWNER_EMAIL,
	ENTERPRISE_SEED_EPOCH_MS,
	type EnterpriseDataset,
	type EnterpriseLocationRow,
	type EnterpriseMemberRow,
	type EnterpriseOrganizationRow,
} from "../enterprise-dataset";
import type { ProductSeedRow } from "../products";
import { seedReferenceData } from "../reference-data";
import { requireRow } from "../require-row";
import { buildCategorySeedRows, seedSamplePlatform } from "../sample-platform";
import { seedStores } from "../stores";
import { printPlatformAccountCredentials, seedPlatformAccounts } from "./platform-accounts";
import { seedLog } from "../seed-log";

/** Seed-only credentials (documented in docs/getting-started.md) — never reuse outside local/test databases. */
const ENTERPRISE_OWNER_PASSWORD = "EnterpriseOwner@123";
const ENTERPRISE_MEMBER_PASSWORD = "EnterpriseMember@123";
/** Matches the other seeders; seed accounts are never production accounts. */
const SEED_BCRYPT_ROUNDS = 10;
const CONSUMER_ROLE_NAME = "User";

export interface EnterpriseScenarioOptions {
	readonly seed: number;
}

interface EnterprisePersistSummary {
	readonly locations: number;
	readonly members: number;
	readonly products: number;
}

interface EnterprisePasswordHashes {
	readonly owner: string;
	readonly member: string;
}

async function upsertOrganization(organization: EnterpriseOrganizationRow): Promise<void> {
	await prisma.organization.upsert({
		where: { id: organization.id },
		create: {
			id: organization.id,
			slug: organization.slug,
			displayName: organization.displayName,
			lifecycleState: "ACTIVE",
			createdAt: organization.createdAt,
		},
		update: {
			slug: organization.slug,
			displayName: organization.displayName,
			lifecycleState: "ACTIVE",
			isDeleted: false,
			deletedAt: null,
		},
	});

	const merchantProfile: Omit<Prisma.OrganizationMerchantProfileUncheckedCreateInput, "organizationId"> = {
		legalName: organization.legalName,
		category: organization.category,
		addressText: organization.addressText,
		city: organization.city,
		kybStatus: "APPROVED",
		contactEmail: organization.contactEmail,
		contactPhone: organization.contactPhone,
	};
	await prisma.organizationMerchantProfile.upsert({
		where: { organizationId: organization.id },
		create: { organizationId: organization.id, ...merchantProfile },
		update: merchantProfile,
	});

	await prisma.tenantPlacement.upsert({
		where: { organizationId: organization.id },
		create: { organizationId: organization.id, kind: "SHARED", regionCode: "default" },
		update: { kind: "SHARED", regionCode: "default" },
	});

	const entitlement: Omit<Prisma.OrganizationEntitlementUncheckedCreateInput, "id" | "organizationId"> = {
		planCode: "enterprise",
		features: { rewards: true, apiKeys: true, analytics: true },
		version: 1,
		effectiveFrom: BigInt(ENTERPRISE_SEED_EPOCH_MS),
		effectiveUntil: null,
	};
	await prisma.organizationEntitlement.upsert({
		where: { id: organization.entitlementId },
		create: { id: organization.entitlementId, organizationId: organization.id, ...entitlement },
		update: entitlement,
	});
}

async function upsertLocations(organizationId: string, locations: readonly EnterpriseLocationRow[], reviewerUserId: string): Promise<void> {
	for (const location of locations) {
		const isReviewed = location.status === "ACTIVE";
		const data = {
			name: location.name,
			code: location.code,
			addressText: location.addressText,
			city: location.city,
			contactPhone: location.contactPhone,
			status: location.status,
			isPrimary: location.isPrimary,
			requestedByUserId: reviewerUserId,
			reviewedByUserId: isReviewed ? reviewerUserId : null,
			reviewedAt: isReviewed ? location.createdAt : null,
			updatedAt: BigInt(ENTERPRISE_SEED_EPOCH_MS),
		};
		await prisma.organizationLocation.upsert({
			where: { id: location.id },
			create: { id: location.id, organizationId, createdAt: location.createdAt, ...data },
			update: { ...data, isDeleted: false, deletedAt: null },
		});
	}
}

async function upsertMemberUser(member: EnterpriseMemberRow, passwordHash: string, consumerRole: Role): Promise<User> {
	const user = await prisma.user.upsert({
		where: { email: member.email },
		create: {
			id: member.userId,
			email: member.email,
			fullName: member.fullName,
			passwordHash,
			phone: member.phone,
			isActive: true,
			emailVerifiedAt: member.joinedAt,
			createdAt: member.joinedAt,
		},
		// Never overwrite passwordHash: a developer may have changed it locally.
		update: {
			fullName: member.fullName,
			phone: member.phone,
			isActive: true,
			isDeleted: false,
			deletedAt: null,
		},
	});

	await prisma.userRole.upsert({
		where: { userId_roleId: { userId: user.id, roleId: consumerRole.id } },
		create: { userId: user.id, roleId: consumerRole.id },
		update: { isDeleted: false, deletedAt: null },
	});

	return user;
}

async function upsertMembership(organizationId: string, member: EnterpriseMemberRow, userId: string): Promise<void> {
	const membership = await prisma.organizationMembership.upsert({
		where: { organizationId_userId: { organizationId, userId } },
		create: {
			id: member.membershipId,
			organizationId,
			userId,
			role: member.role,
			status: "ACTIVE",
			displayName: member.fullName,
			createdAt: member.joinedAt,
		},
		update: {
			role: member.role,
			status: "ACTIVE",
			displayName: member.fullName,
			isDeleted: false,
			deletedAt: null,
		},
	});

	const locationId = member.scope.scopeType === "SELECTED" ? member.scope.locationId : null;
	await prisma.organizationMembershipLocationScope.upsert({
		where: { id: member.scope.id },
		create: { id: member.scope.id, organizationId, membershipId: membership.id, scopeType: member.scope.scopeType, locationId },
		update: { organizationId, membershipId: membership.id, scopeType: member.scope.scopeType, locationId },
	});
}

async function upsertProducts(products: readonly ProductSeedRow[]): Promise<void> {
	for (const product of products) {
		const data = {
			sku: product.sku,
			name: product.name,
			slug: product.slug,
			shortDescription: product.shortDescription,
			description: product.description,
			price: product.price,
			compareAtPrice: product.compareAtPrice,
			stockQuantity: product.stockQuantity,
			categoryId: product.categoryId,
			brand: product.brand,
			weightGrams: product.weightGrams,
			imageUrl: product.imageUrl,
			isActive: product.isActive,
			isFeatured: product.isFeatured,
			version: product.version,
			updatedAt: product.updatedAt,
		};
		await prisma.product.upsert({
			where: { id: product.id },
			create: { id: product.id, createdAt: product.createdAt, ...data },
			update: { ...data, deletedAt: null },
		});
	}
}

async function hashSeedPasswords(): Promise<EnterprisePasswordHashes> {
	const [owner, member] = await Promise.all([bcrypt.hash(ENTERPRISE_OWNER_PASSWORD, SEED_BCRYPT_ROUNDS), bcrypt.hash(ENTERPRISE_MEMBER_PASSWORD, SEED_BCRYPT_ROUNDS)]);
	return { owner, member };
}

async function persistEnterpriseDataset(dataset: EnterpriseDataset, roles: readonly Role[]): Promise<EnterprisePersistSummary> {
	const consumerRole = requireRow(
		roles.find((role) => role.name === CONSUMER_ROLE_NAME),
		`role ${CONSUMER_ROLE_NAME}`,
	);
	const passwords = await hashSeedPasswords();

	const owner = requireRow(
		dataset.members.find((member) => member.email === ENTERPRISE_OWNER_EMAIL),
		`enterprise member ${ENTERPRISE_OWNER_EMAIL}`,
	);
	const ownerUser = await upsertMemberUser(owner, passwords.owner, consumerRole);

	seedLog("Upserting enterprise organization...");
	await upsertOrganization(dataset.organization);

	seedLog(`Upserting ${String(dataset.locations.length)} locations...`);
	await upsertLocations(dataset.organization.id, dataset.locations, ownerUser.id);

	seedLog(`Upserting ${String(dataset.members.length)} members (users, memberships, location scopes)...`);
	for (const member of dataset.members) {
		const user = member.email === ENTERPRISE_OWNER_EMAIL ? ownerUser : await upsertMemberUser(member, passwords.member, consumerRole);
		await upsertMembership(dataset.organization.id, member, user.id);
	}

	seedLog("Publishing default tenant Cedar policies...");
	await seedRewardHubTenantPolicies(prisma, dataset.organization.id, ownerUser.id);

	seedLog(`Upserting ${String(dataset.products.length)} products...`);
	await upsertProducts(dataset.products);

	return { locations: dataset.locations.length, members: dataset.members.length, products: dataset.products.length };
}

/**
 * `enterprise` scenario: reference data, the platform test accounts, and ONE
 * large deterministic tenant (see enterprise-dataset.ts for the determinism
 * contract). Additive — it never deletes other tenants.
 */
export async function runEnterpriseScenario(options: EnterpriseScenarioOptions): Promise<void> {
	const reference = await seedReferenceData();
	await seedPlatformAccounts(reference);

	seedLog("Seeding sample categories...");
	const categorySummary = await seedSamplePlatform();
	seedLog(`✅ Categories: ${String(categorySummary.categories)}`);

	const dataset = buildEnterpriseDataset({
		seed: options.seed,
		sizes: ENTERPRISE_DATASET_SIZES,
		categoryIds: buildCategorySeedRows().map((category) => category.id),
	});
	const summary = await persistEnterpriseDataset(dataset, reference.roles);

	seedLog("Seeding stores and store memberships...");
	const storeSummary = await seedStores(reference.roles);
	seedLog(`✅ Stores (all tenants): ${String(storeSummary.stores)} stores, ${String(storeSummary.memberships)} store memberships`);

	const lastMember = requireRow(dataset.members.at(-1), "last enterprise member");
	seedLog(`
🎉 Seed complete! (scenario: enterprise, seed: ${String(options.seed)})

📋 Enterprise tenant — ${dataset.organization.displayName} (/orgs/${dataset.organization.slug}/dashboard)
──────────────────────────────────────────────
Locations/stores : ${String(summary.locations)}
Members          : ${String(summary.members)}
Products         : ${String(summary.products)}

🔑 Enterprise accounts
──────────────────────────────────────────────
${ENTERPRISE_OWNER_EMAIL}               /  ${ENTERPRISE_OWNER_PASSWORD}   (OWNER · all locations)
member.0001@… through ${lastMember.email}  /  ${ENTERPRISE_MEMBER_PASSWORD}
  (roles by index: POLICY_ADMIN, ADMIN, MEMBER, CASHIER)
`);
	printPlatformAccountCredentials();
}
