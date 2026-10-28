import type { Prisma, Role, User } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PILOT_CITY_TIME_ZONES } from "@workspace/shared";

import { seedAccountSecurity } from "../account-security";
import { prisma } from "../client";
import { upsertLiveSeedMembership } from "../memberships";
import { assignSeedRole } from "../rbac-audit";
import {
	buildEnterpriseDataset,
	ENTERPRISE_DATASET_SIZES,
	ENTERPRISE_OWNER_EMAIL,
	ENTERPRISE_SEED_EPOCH_MS,
	type EnterpriseDataset,
	type EnterpriseLocationRow,
	type EnterpriseMemberRow,
	type EnterpriseTenantRow,
} from "../enterprise-dataset";
import type { ProductSeedRow } from "../products";
import { seedReferenceData } from "../reference-data";
import { requireRow } from "../require-row";
import { buildCategorySeedRows, seedSamplePlatform } from "../sample-platform";
import { seedLocationRoles } from "../location-roles";
import { PLATFORM_SUPERADMIN_EMAIL, printPlatformAccountCredentials, seedPlatformAccounts } from "./platform-accounts";
import { seedLog } from "../seed-log";

/** Seed-only credentials (documented in docs/technical/database.md, "Seed data") — never reuse outside local/test databases. */
const ENTERPRISE_OWNER_PASSWORD = "EnterpriseOwner@123";
const ENTERPRISE_MEMBER_PASSWORD = "EnterpriseMember@123";
/** Matches the other seeders; seed accounts are never production accounts. */
const SEED_BCRYPT_ROUNDS = 10;
const CONSUMER_ROLE_NAME = "User";
/** Enterprise members (by dataset index; 0 is the owner) cast in the account-security history. */
const ENTERPRISE_RECOVERED_MEMBER_INDEX = 3;
const ENTERPRISE_MFA_MEMBER_INDEX = 4;
const ENTERPRISE_ENROLLING_MEMBER_INDEX = 5;
const ENTERPRISE_LOCKED_MEMBER_INDEX = 6;

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

async function upsertTenant(tenant: EnterpriseTenantRow): Promise<void> {
	await prisma.tenant.upsert({
		where: { id: tenant.id },
		create: {
			id: tenant.id,
			slug: tenant.slug,
			displayName: tenant.displayName,
			lifecycleState: "ACTIVE",
			// Analytics weeks are cut in the tenant's own zone (its head-office city's).
			timeZone: PILOT_CITY_TIME_ZONES[tenant.city],
			createdAt: tenant.createdAt,
		},
		update: {
			slug: tenant.slug,
			displayName: tenant.displayName,
			lifecycleState: "ACTIVE",
			timeZone: PILOT_CITY_TIME_ZONES[tenant.city],
			isDeleted: false,
			deletedAt: null,
		},
	});

	const merchantProfile: Omit<Prisma.TenantMerchantProfileUncheckedCreateInput, "tenantId"> = {
		legalName: tenant.legalName,
		category: tenant.category,
		addressText: tenant.addressText,
		city: tenant.city,
		kybStatus: "APPROVED",
		contactEmail: tenant.contactEmail,
		contactPhone: tenant.contactPhone,
	};
	await prisma.tenantMerchantProfile.upsert({
		where: { tenantId: tenant.id },
		create: { tenantId: tenant.id, ...merchantProfile },
		update: merchantProfile,
	});

	await prisma.tenantPlacement.upsert({
		where: { tenantId: tenant.id },
		create: { tenantId: tenant.id, kind: "SHARED", regionCode: "default" },
		update: { kind: "SHARED", regionCode: "default" },
	});
}

async function upsertLocations(tenantId: string, locations: readonly EnterpriseLocationRow[], reviewerUserId: string): Promise<void> {
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
		await prisma.location.upsert({
			where: { id: location.id },
			create: { id: location.id, tenantId, createdAt: location.createdAt, ...data },
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

	// Self-provisioned account: the user is the audited actor (as `RoleService.assignDefaultConsumerRole`).
	await assignSeedRole({ userId: user.id, roleId: consumerRole.id, actorId: user.id, action: "ROLE_ASSIGNED_AT_PROVISIONING", scenario: "enterprise" });

	return user;
}

async function upsertMembership(tenantId: string, member: EnterpriseMemberRow, userId: string): Promise<void> {
	const membership = await upsertLiveSeedMembership({
		id: member.membershipId,
		tenantId,
		userId,
		role: member.role,
		displayName: member.fullName,
		createdAt: member.joinedAt,
	});

	const locationId = member.scope.scopeType === "SELECTED" ? member.scope.locationId : null;
	await prisma.membershipLocationScope.upsert({
		where: { id: member.scope.id },
		create: { id: member.scope.id, tenantId, membershipId: membership.id, scopeType: member.scope.scopeType, locationId },
		update: { tenantId, membershipId: membership.id, scopeType: member.scope.scopeType, locationId },
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

	seedLog("Upserting enterprise tenant...");
	await upsertTenant(dataset.tenant);

	seedLog(`Upserting ${String(dataset.locations.length)} locations...`);
	await upsertLocations(dataset.tenant.id, dataset.locations, ownerUser.id);

	seedLog(`Upserting ${String(dataset.members.length)} members (users, memberships, location scopes)...`);
	for (const member of dataset.members) {
		const user = member.email === ENTERPRISE_OWNER_EMAIL ? ownerUser : await upsertMemberUser(member, passwords.member, consumerRole);
		await upsertMembership(dataset.tenant.id, member, user.id);
	}

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

	seedLog("Seeding location roles...");
	const locationRoles = await seedLocationRoles(reference.roles);
	seedLog(`✅ Location roles (all tenants): ${String(locationRoles.scopesWithRole)} location scopes with a role, ${String(locationRoles.closedLocations)} closed location`);

	seedLog("Seeding account security (impersonation, MFA recovery, 2FA enrollment, lockout, password history, support access)...");
	const memberEmail = (index: number): string => requireRow(dataset.members.at(index), `enterprise member #${String(index)}`).email;
	await seedAccountSecurity(
		{
			namespace: "seed.account-security.enterprise",
			superAdmin: PLATFORM_SUPERADMIN_EMAIL,
			recoveredUser: memberEmail(ENTERPRISE_RECOVERED_MEMBER_INDEX),
			mfaUser: memberEmail(ENTERPRISE_MFA_MEMBER_INDEX),
			enrollingUser: memberEmail(ENTERPRISE_ENROLLING_MEMBER_INDEX),
			lockedUser: memberEmail(ENTERPRISE_LOCKED_MEMBER_INDEX),
			supportAccess: { tenantId: dataset.tenant.id, ownerEmail: ENTERPRISE_OWNER_EMAIL },
		},
		seedLog,
	);

	const lastMember = requireRow(dataset.members.at(-1), "last enterprise member");
	seedLog(`
🎉 Seed complete! (scenario: enterprise, seed: ${String(options.seed)})

📋 Enterprise tenant — ${dataset.tenant.displayName} (/tenants/${dataset.tenant.slug}/dashboard)
──────────────────────────────────────────────
Locations/stores : ${String(summary.locations)}
Members          : ${String(summary.members)}
Products         : ${String(summary.products)}

🔑 Enterprise accounts
──────────────────────────────────────────────
${ENTERPRISE_OWNER_EMAIL}               /  ${ENTERPRISE_OWNER_PASSWORD}   (OWNER · all locations)
member.0001@… through ${lastMember.email}  /  ${ENTERPRISE_MEMBER_PASSWORD}
  (roles by index: MANAGER at #1 and every 25th, CASHIER otherwise)
`);
	printPlatformAccountCredentials();
}
