import type { Tenant, Prisma, User } from "@prisma/client";
import { PILOT_CITY_TIME_ZONES } from "@workspace/shared";

import { sha256Hex } from "../../src/platform/infrastructure/crypto/sha256";
import { OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION } from "../../src/contexts/tenancy/application/commands/rename-own-membership/rename-own-membership.handler";

import { prisma } from "./client";
import { seedTenantRoleId } from "./tenant-roles";
import { seedLifecycleCorrelationId } from "./lifecycle-correlation";
import { upsertLiveSeedMembership } from "./memberships";
import { deterministicUuid } from "./deterministic-uuid";
import { daysFromNow } from "./helpers";
import { seedTenantEncryptionKeys } from "./tenant-encryption";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";
import { seedLog } from "./seed-log";

export { TENANT_SEED_IDS, SINGLE_TENANT_SEED_TENANT_ID } from "./tenant-seed-ids";

/** Plaintext team invite token for Brew & Bean KL pending cashier invite (seed only). */
export const SEED_TEAM_INVITE_TOKEN_KL_ALICE = "seed_team_invite_token_kl_alice";

export const TENANT_SEED_SLUGS = Object.freeze({
	kl: "brew-bean-kl",
	mlk: "jonker-street-kitchen",
});

/** The tenants the `development` scenario owns — the ONLY tenants its cleanup touches. */
export const SEED_TENANT_IDS: readonly string[] = [TENANT_SEED_IDS.klTenant, TENANT_SEED_IDS.mlkTenant];

/** Store the Jonker Street Kitchen owner asked for and the platform has not approved yet. */
const MLK_PENDING_LOCATION_ID = deterministicUuid("tenant-seed", "mlk-ayer-keroh-pending");

/**
 * Alice's earlier, since-removed Brew & Bean KL cashier membership (soft
 * deleted). The one-live-membership unique index ignores it, so her pending
 * re-invite can still be accepted — the re-hire path the index exists for.
 */
const KL_FORMER_CASHIER_MEMBERSHIP_ID = deterministicUuid("tenant-seed", "kl-alice-former-cashier");
const KL_FORMER_CASHIER_REMOVAL_AUDIT_ID = deterministicUuid("tenant-seed-audit", "kl-alice-former-cashier-removed");
/** Days before the seed run that Alice's former membership was removed. */
const KL_FORMER_CASHIER_REMOVED_DAYS_AGO = 30;

/**
 * Removes the re-creatable child rows of the SEED tenants only, so the
 * next run converges. Never touches another tenant, never deletes the
 * tenants themselves (their audit trail — `TenantAuditLog`,
 * `TenantLifecycleEvent` — cascades from them and is kept), and keeps
 * tenant data keys (a data key is never destroyed: it
 * would orphan what is encrypted with it; the seed creates it once).
 */
export async function cleanupTenantSeedData(): Promise<void> {
	const tenantId = { in: [...SEED_TENANT_IDS] };
	await prisma.supportAccessGrant.deleteMany({ where: { tenantId } });
	await prisma.tenantInvitationLocationScope.deleteMany({ where: { tenantId } });
	await prisma.tenantInvitation.deleteMany({ where: { tenantId } });
	await prisma.membershipLocationScope.deleteMany({ where: { tenantId } });
}

/**
 * The one PENDING access request of `userId` for `tenantId`, converged in place. The table has no
 * DELETE policy (a request is reviewed, never hard-deleted) and its uniqueness is a partial index
 * (`WHERE status = 'PENDING'`, which ON CONFLICT cannot target), so a reseed updates the request it
 * finds — including one an earlier seed created under a random id — and creates it only when absent.
 */
async function convergePendingAccessRequest(tenantId: string, userId: string, message: string): Promise<void> {
	const existing = await prisma.tenantAccessRequest.findFirst({ where: { tenantId, userId, status: "PENDING" }, select: { id: true } });
	if (existing !== null) {
		await prisma.tenantAccessRequest.update({ where: { id: existing.id }, data: { message } });
		return;
	}
	await prisma.tenantAccessRequest.create({
		data: { id: deterministicUuid("tenant-seed", `access-request:${tenantId}:${userId}`), tenantId, userId, status: "PENDING", message },
	});
}

export interface SeededTenants {
	readonly klTenant: Tenant;
	readonly mlkTenant: Tenant;
}

interface SeedLocation {
	readonly id: string;
	readonly name: string;
	readonly code: string;
	readonly addressText: string;
	readonly city: "KUALA_LUMPUR" | "MELAKA";
	readonly contactPhone: string;
	readonly isPrimary: boolean;
	readonly status: "ACTIVE" | "PENDING_APPROVAL";
}

interface SeedTenant {
	readonly id: string;
	readonly slug: string;
	readonly displayName: string;
	readonly owner: User;
	readonly locations: readonly SeedLocation[];
	readonly profile: Omit<Prisma.TenantMerchantProfileUncheckedCreateInput, "tenantId">;
	/** IANA zone the merchant's analytics weeks are cut in (its primary city's zone). */
	readonly timeZone: string;
}

/**
 * Creates the tenant, or brings an existing one back to its seed state
 * (upserts — the row and its audit trail are never deleted). The ONE
 * PROVISIONING → ACTIVE lifecycle event is found by its natural key (the
 * tenant + transition + reason), created when missing and otherwise
 * brought to its seed correlation id, so a re-run never duplicates it.
 */
async function upsertSeedTenant(input: SeedTenant, adminUser: User, now: bigint): Promise<Tenant> {
	const tenant = await prisma.tenant.upsert({
		where: { id: input.id },
		create: { id: input.id, slug: input.slug, displayName: input.displayName, lifecycleState: "ACTIVE", timeZone: input.timeZone },
		update: { slug: input.slug, displayName: input.displayName, lifecycleState: "ACTIVE", timeZone: input.timeZone, isDeleted: false, deletedAt: null },
	});
	const activation = {
		tenantId: input.id,
		fromState: "PROVISIONING",
		toState: "ACTIVE",
		reason: "Seed: tenant provisioned",
	} satisfies Prisma.TenantLifecycleEventWhereInput;
	const correlationId = seedLifecycleCorrelationId(`${input.id}:activated`);
	const activationEvent = await prisma.tenantLifecycleEvent.findFirst({ where: activation, select: { id: true } });
	if (activationEvent === null) {
		await prisma.tenantLifecycleEvent.create({ data: { ...activation, actorUserId: adminUser.id, correlationId } });
	} else {
		await prisma.tenantLifecycleEvent.update({ where: { id: activationEvent.id }, data: { correlationId } });
	}

	for (const location of input.locations) {
		const reviewed = location.status === "ACTIVE";
		const data = {
			name: location.name,
			code: location.code,
			addressText: location.addressText,
			city: location.city,
			contactPhone: location.contactPhone,
			isPrimary: location.isPrimary,
			status: location.status,
			requestedByUserId: input.owner.id,
			reviewedByUserId: reviewed ? input.owner.id : null,
			reviewedAt: reviewed ? now : null,
		};
		// Keyed by (tenant, code) — the natural key — so rows from runs that predate the fixed
		// ids (same code, random id) are reconciled in place instead of colliding on the unique index.
		await prisma.location.upsert({
			where: { tenantId_code: { tenantId: input.id, code: location.code } },
			create: { id: location.id, tenantId: input.id, ...data },
			update: { ...data, isDeleted: false, deletedAt: null },
		});
	}

	await prisma.tenantMerchantProfile.upsert({
		where: { tenantId: input.id },
		create: { tenantId: input.id, ...input.profile },
		update: input.profile,
	});
	await prisma.tenantPlacement.upsert({
		where: { tenantId: input.id },
		create: { tenantId: input.id, kind: "SHARED", regionCode: "default" },
		update: { kind: "SHARED", regionCode: "default" },
	});
	return tenant;
}

/** Display names the demo members chose for themselves (`null`: the member never set one — the roster shows the full name). */
const SEED_MEMBER_DISPLAY_NAMES = {
	klOwner: "Ahmad (Owner)",
	klCashier: "Lee — Bukit Bintang counter",
	mlkOwner: null,
	mlkCashier: "Kak Mira",
} satisfies Readonly<Record<string, string | null>>;

async function upsertSeedMembership(id: string, tenantId: string, userId: string, role: "OWNER" | "CASHIER", displayName: string | null): Promise<void> {
	await upsertLiveSeedMembership({ id, tenantId, userId, role, displayName });
}

export async function seedTenantsAndMerchants(
	adminUser: User,
	klOwner: User,
	mlkOwner: User,
	klCashier: User,
	mlkCashier: User,
	accessRequestUser: User,
	klPendingCashier: User,
): Promise<SeededTenants> {
	const now = BigInt(Date.now());

	const klPrimaryAddress = "12 Jalan Bukit Bintang, Kuala Lumpur";
	const klPrimaryPhone = "+60321456789";

	const klTenant = await upsertSeedTenant(
		{
			id: TENANT_SEED_IDS.klTenant,
			slug: TENANT_SEED_SLUGS.kl,
			displayName: "Brew & Bean KL",
			owner: klOwner,
			locations: [
				{
					id: TENANT_SEED_IDS.klLocation,
					name: "Brew & Bean KL — Bukit Bintang",
					code: "primary",
					addressText: klPrimaryAddress,
					city: "KUALA_LUMPUR",
					contactPhone: klPrimaryPhone,
					isPrimary: true,
					status: "ACTIVE",
				},
			],
			profile: {
				legalName: "Brew & Bean KL Sdn Bhd",
				category: "cafe",
				addressText: klPrimaryAddress,
				city: "KUALA_LUMPUR",
				kybStatus: "APPROVED",
				kybFields: { registrationNo: "201901012345", taxId: "C12345678" },
				contactEmail: klOwner.email,
				contactPhone: klPrimaryPhone,
			},
			timeZone: PILOT_CITY_TIME_ZONES.KUALA_LUMPUR,
		},
		adminUser,
		now,
	);

	const mlkPrimaryAddress = "12 Jalan Bukit Katil, 75450 Melaka";
	const mlkPrimaryPhone = "+6062812345";

	const mlkTenant = await upsertSeedTenant(
		{
			id: TENANT_SEED_IDS.mlkTenant,
			slug: TENANT_SEED_SLUGS.mlk,
			displayName: "Jonker Street Kitchen",
			owner: mlkOwner,
			locations: [
				{
					id: TENANT_SEED_IDS.mlkLocationKatil,
					name: "Jonker Street Kitchen — Bukit Katil",
					code: "bukit-katil",
					addressText: mlkPrimaryAddress,
					city: "MELAKA",
					contactPhone: mlkPrimaryPhone,
					isPrimary: true,
					status: "ACTIVE",
				},
				{
					id: TENANT_SEED_IDS.mlkLocationBeruang,
					name: "Jonker Street Kitchen — Bukit Beruang",
					code: "bukit-beruang",
					addressText: "88 Jalan Bukit Beruang, 75450 Melaka",
					city: "MELAKA",
					contactPhone: "+6062815678",
					isPrimary: false,
					status: "ACTIVE",
				},
				{
					id: MLK_PENDING_LOCATION_ID,
					name: "Jonker Street Kitchen — Ayer Keroh (Pending)",
					code: "ayer-keroh-pending",
					addressText: "5 Jalan Lagenda, 75450 Melaka",
					city: "MELAKA",
					contactPhone: "+6062830000",
					isPrimary: false,
					status: "PENDING_APPROVAL",
				},
			],
			profile: {
				legalName: "Jonker Kitchen Melaka",
				category: "restaurant",
				addressText: mlkPrimaryAddress,
				city: "MELAKA",
				kybStatus: "PENDING",
				kybFields: { registrationNo: "202002023456" },
				contactEmail: mlkOwner.email,
				contactPhone: mlkPrimaryPhone,
			},
			timeZone: PILOT_CITY_TIME_ZONES.MELAKA,
		},
		adminUser,
		now,
	);

	await upsertSeedMembership(TENANT_SEED_IDS.klOwnerMembership, klTenant.id, klOwner.id, "OWNER", SEED_MEMBER_DISPLAY_NAMES.klOwner);
	await upsertSeedMembership(TENANT_SEED_IDS.klCashierMembership, klTenant.id, klCashier.id, "CASHIER", SEED_MEMBER_DISPLAY_NAMES.klCashier);
	await upsertSeedMembership(TENANT_SEED_IDS.mlkOwnerMembership, mlkTenant.id, mlkOwner.id, "OWNER", SEED_MEMBER_DISPLAY_NAMES.mlkOwner);
	await upsertSeedMembership(TENANT_SEED_IDS.mlkCashierMembership, mlkTenant.id, mlkCashier.id, "CASHIER", SEED_MEMBER_DISPLAY_NAMES.mlkCashier);

	await prisma.membershipLocationScope.createMany({
		data: [
			{
				tenantId: klTenant.id,
				membershipId: TENANT_SEED_IDS.klOwnerMembership,
				scopeType: "ALL_LOCATIONS",
			},
			{
				tenantId: klTenant.id,
				membershipId: TENANT_SEED_IDS.klCashierMembership,
				scopeType: "SELECTED",
				locationId: TENANT_SEED_IDS.klLocation,
			},
			{
				tenantId: mlkTenant.id,
				membershipId: TENANT_SEED_IDS.mlkOwnerMembership,
				scopeType: "ALL_LOCATIONS",
			},
			{
				tenantId: mlkTenant.id,
				membershipId: TENANT_SEED_IDS.mlkCashierMembership,
				scopeType: "SELECTED",
				locationId: TENANT_SEED_IDS.mlkLocationBeruang,
			},
		],
	});

	await prisma.tenantInvitation.create({
		data: {
			id: TENANT_SEED_IDS.pendingNyonyaInvitation,
			tenantId: mlkTenant.id,
			email: "pending.invite@melaka-rewards.demo",
			tokenHash: sha256Hex("seed_invite_token_mlk_pending"),
			kind: "PLATFORM_ONBOARDING",
			intendedRole: "OWNER",
			locationScopeType: "ALL_LOCATIONS",
			status: "PENDING",
			createdByAdminId: adminUser.id,
			expiresAt: BigInt(daysFromNow(7)),
		},
	});

	await prisma.tenantInvitation.create({
		data: {
			id: TENANT_SEED_IDS.pendingKlTeamInvitation,
			tenantId: klTenant.id,
			email: klPendingCashier.email,
			tokenHash: sha256Hex(SEED_TEAM_INVITE_TOKEN_KL_ALICE),
			kind: "TEAM_MEMBER",
			intendedRole: "CASHIER",
			locationScopeType: "SELECTED",
			status: "PENDING",
			createdByAdminId: klOwner.id,
			expiresAt: BigInt(daysFromNow(7)),
			locationScopes: {
				create: {
					tenantId: klTenant.id,
					locationId: TENANT_SEED_IDS.klLocation,
				},
			},
		},
	});

	await convergePendingAccessRequest(mlkTenant.id, accessRequestUser.id, "I run a food blog and would like to help promote Jonker Street Kitchen rewards.");

	await seedFormerKlCashierMembership(klTenant.id, klOwner.id, klPendingCashier.id);
	await seedMemberDisplayNameAudits([
		{ tenantId: klTenant.id, membershipId: TENANT_SEED_IDS.klOwnerMembership, userId: klOwner.id, displayName: SEED_MEMBER_DISPLAY_NAMES.klOwner },
		{ tenantId: klTenant.id, membershipId: TENANT_SEED_IDS.klCashierMembership, userId: klCashier.id, displayName: SEED_MEMBER_DISPLAY_NAMES.klCashier },
		{ tenantId: mlkTenant.id, membershipId: TENANT_SEED_IDS.mlkCashierMembership, userId: mlkCashier.id, displayName: SEED_MEMBER_DISPLAY_NAMES.mlkCashier },
	]);

	// Real wrapped data keys (after the tenant policies, so the audit rows carry the live policy version).
	// The Melaka tenant's key has been through a KEK re-wrap (`db:rewrap-tenant-keys`, run by a SuperAdmin).
	const superAdmin = await prisma.user.findFirstOrThrow({ where: { isSuperAdmin: true, isActive: true, isDeleted: false }, orderBy: { email: "asc" }, select: { id: true } });
	await seedTenantEncryptionKeys([
		{ tenantId: klTenant.id, actorUserId: adminUser.id },
		{ tenantId: mlkTenant.id, actorUserId: adminUser.id, rewrappedByUserId: superAdmin.id },
	]);

	return { klTenant, mlkTenant };
}

/**
 * Alice's removed membership: soft-deleted (never hard-deleted) with its
 * store scope kept for history, plus the tenant audit row the removal
 * would have written (actor = the KL owner, live policy version).
 */
async function seedFormerKlCashierMembership(tenantId: string, removedByUserId: string, userId: string): Promise<void> {
	const removedAt = BigInt(Date.now() - KL_FORMER_CASHIER_REMOVED_DAYS_AGO * 24 * 60 * 60 * 1000);
	const roleId = await seedTenantRoleId(prisma, tenantId, "CASHIER");
	await prisma.membership.upsert({
		where: { id: KL_FORMER_CASHIER_MEMBERSHIP_ID },
		create: {
			id: KL_FORMER_CASHIER_MEMBERSHIP_ID,
			tenantId,
			userId,
			role: "CASHIER",
			roleId,
			status: "ACTIVE",
			isDeleted: true,
			deletedAt: removedAt,
			deletedBy: removedByUserId,
		},
		update: { tenantId, userId, role: "CASHIER", roleId, isDeleted: true, deletedAt: removedAt, deletedBy: removedByUserId },
	});
	// Removing the member retired their store scope with them: soft-deleted, by the same owner, at the same time.
	await prisma.membershipLocationScope.create({
		data: {
			tenantId,
			membershipId: KL_FORMER_CASHIER_MEMBERSHIP_ID,
			scopeType: "SELECTED",
			locationId: TENANT_SEED_IDS.klLocation,
			isDeleted: true,
			deletedAt: removedAt,
			deletedBy: removedByUserId,
		},
	});
	await prisma.tenantAuditLog.upsert({
		where: { id: KL_FORMER_CASHIER_REMOVAL_AUDIT_ID },
		create: {
			id: KL_FORMER_CASHIER_REMOVAL_AUDIT_ID,
			tenantId,
			actorUserId: removedByUserId,
			action: "membership.removed",
			resourceType: "Membership",
			resourceId: KL_FORMER_CASHIER_MEMBERSHIP_ID,
			createdAt: removedAt,
		},
		update: {},
	});
}

interface SeedMemberDisplayName {
	readonly tenantId: string;
	readonly membershipId: string;
	readonly userId: string;
	readonly displayName: string;
}

/**
 * The tenant audit row `PATCH /tenants/:tenantSlug/members/me` writes when a
 * member sets their display name (actor = the member, live policy version),
 * one per seeded display name. Keyed by the membership, so a re-run converges.
 */
async function seedMemberDisplayNameAudits(rows: readonly SeedMemberDisplayName[]): Promise<void> {
	for (const row of rows) {
		const auditId = deterministicUuid("tenant-seed-audit", `${row.membershipId}:display-name`);
		const audit = {
			tenantId: row.tenantId,
			actorUserId: row.userId,
			action: OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION,
			resourceType: "Membership",
			resourceId: row.membershipId,
			metadata: { previousDisplayName: null, displayName: row.displayName },
		};
		await prisma.tenantAuditLog.upsert({ where: { id: auditId }, create: { id: auditId, ...audit }, update: audit });
	}
}

export function printTenantSeedCredentials(): void {
	seedLog(`
🏢 Tenant workspace (merchant portal)
──────────────────────────────────────────────
Brew & Bean KL — brew.owner@kl-rewards.demo / BrewOwner@123
  Primary store: Brew & Bean KL — Bukit Bintang (12 Jalan Bukit Bintang, Kuala Lumpur)
  Canonical:     /tenants/${TENANT_SEED_SLUGS.kl}/dashboard
  By org id:     /tenants/${TENANT_SEED_IDS.klTenant}/dashboard

Jonker Street Kitchen — jonker.owner@melaka-rewards.demo / JonkerOwner@123
  Stores:        Bukit Katil (primary), Bukit Beruang (active), Ayer Keroh (pending approval)
  Canonical:     /tenants/${TENANT_SEED_SLUGS.mlk}/dashboard
  By org id:     /tenants/${TENANT_SEED_IDS.mlkTenant}/dashboard

Pending team invite (Brew & Bean KL → Bukit Bintang cashier)
  Invitee:       alice.kl@kl-rewards.demo / AliceKl@123
  Accept URL:    /team-invite?token=${SEED_TEAM_INVITE_TOKEN_KL_ALICE}

UUID paths redirect to the canonical slug URL after login.
`);
}
