import type { Organization, Prisma, User } from "@prisma/client";
import { PILOT_CITY_TIME_ZONES } from "@workspace/shared";

import { sha256Hex } from "../../src/common/crypto/sha256";
import { POLICY_AUDIT_ACTIONS, POLICY_DRAFT_AUDIT_RESOURCE } from "../../src/modules/authorization-cedar/constants/policy-control-plane.constants";
import { policyBaselineFingerprint } from "../../src/modules/authorization-cedar/services/policy-baseline";
import { PolicyTemplateCompiler } from "../../src/modules/authorization-cedar/services/policy-template.compiler";
import { OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION } from "../../src/modules/organization/services/organization-own-membership.service";
import { findActivePolicyVersionInTx, seedRewardHubTenantPolicies } from "../../src/modules/organization/utils/rewardhub-policy-seed.util";

import { prisma } from "./client";
import { seedLifecycleCorrelationId } from "./lifecycle-correlation";
import { upsertLiveSeedMembership } from "./memberships";
import { deterministicUuid } from "./deterministic-uuid";
import { daysFromNow } from "./helpers";
import { defaultTenantPolicySeedIds, platformGuardrailSeedIds } from "./policy-seed-ids";
import { seedTenantEncryptionKeys } from "./tenant-encryption";
import { ORGANIZATION_SEED_IDS } from "./organization-seed-ids";
import { seedLog } from "./seed-log";

export { ORGANIZATION_SEED_IDS, SINGLE_TENANT_SEED_ORGANIZATION_ID } from "./organization-seed-ids";

/** Plaintext team invite token for Brew & Bean KL pending cashier invite (seed only). */
export const SEED_TEAM_INVITE_TOKEN_KL_ALICE = "seed_team_invite_token_kl_alice";

export const ORGANIZATION_SEED_SLUGS = Object.freeze({
	kl: "brew-bean-kl",
	mlk: "jonker-street-kitchen",
});

/** The organizations the `development` scenario owns — the ONLY tenants its cleanup touches. */
export const SEED_ORGANIZATION_IDS: readonly string[] = [ORGANIZATION_SEED_IDS.klOrganization, ORGANIZATION_SEED_IDS.mlkOrganization];

/** Store the Jonker Street Kitchen owner asked for and the platform has not approved yet. */
const MLK_PENDING_LOCATION_ID = deterministicUuid("organization-seed", "mlk-ayer-keroh-pending");

/**
 * Alice's earlier, since-removed Brew & Bean KL cashier membership (soft
 * deleted). The one-live-membership unique index ignores it, so her pending
 * re-invite can still be accepted — the re-hire path the index exists for.
 */
const KL_FORMER_CASHIER_MEMBERSHIP_ID = deterministicUuid("organization-seed", "kl-alice-former-cashier");
const KL_FORMER_CASHIER_REMOVAL_AUDIT_ID = deterministicUuid("organization-seed-audit", "kl-alice-former-cashier-removed");
/** Days before the seed run that Alice's former membership was removed. */
const KL_FORMER_CASHIER_REMOVED_DAYS_AGO = 30;

/**
 * Removes the re-creatable child rows of the SEED organizations only, so the
 * next run converges. Never touches another tenant, never deletes the
 * organizations themselves (their audit trail — `organization_audit_logs`,
 * `organization_lifecycle_events` — cascades from them and is kept), and keeps
 * tenant policy history and tenant data keys (a data key is never destroyed: it
 * would orphan what is encrypted with it; the seed creates it once).
 */
export async function cleanupOrganizationSeedData(): Promise<void> {
	const organizationId = { in: [...SEED_ORGANIZATION_IDS] };
	await prisma.supportAccessGrant.deleteMany({ where: { organizationId } });
	await prisma.organizationQuota.deleteMany({ where: { organizationId } });
	await prisma.organizationAccessRequest.deleteMany({ where: { organizationId } });
	await prisma.organizationInvitationLocationScope.deleteMany({ where: { organizationId } });
	await prisma.organizationInvitation.deleteMany({ where: { organizationId } });
	await prisma.organizationMembershipLocationScope.deleteMany({ where: { organizationId } });
}

/**
 * Publishes the platform guardrail exactly as the policy control plane would:
 * a draft by `author`, a passing simulation against the current baseline, and
 * four-eyes approval + publish by a DIFFERENT SuperAdmin (`approver`), with
 * the authorization audit rows the app writes — all in one transaction.
 */
export async function seedPlatformGuardrails(author: Pick<User, "id">, approver: Pick<User, "id">): Promise<void> {
	if (author.id === approver.id) {
		throw new Error("Seed guardrail approval needs two distinct users (four-eyes)");
	}
	const existing = await prisma.authorizationPolicyVersion.findFirst({
		where: { organizationId: null, scope: "PLATFORM_GUARDRAIL", supersededAt: null },
	});

	if (existing !== null) {
		return;
	}

	const builderPayload = { templateId: "platform.guardrail.no_escalation", parameters: {} };
	const compiled = new PolicyTemplateCompiler().compile(builderPayload, null);
	const now = Date.now();
	const ids = platformGuardrailSeedIds();

	await prisma.$transaction(async (tx) => {
		const baselineIds = await tx.authorizationPolicyVersion.findMany({ where: { supersededAt: null }, select: { id: true } });
		const memberCount = await tx.organizationMembership.count({ where: { status: "ACTIVE", isDeleted: false } });
		const draft = await tx.authorizationPolicyDraft.create({
			data: {
				id: ids.draftId,
				organizationId: null,
				scope: "PLATFORM_GUARDRAIL",
				name: "Platform guardrails",
				description: "Non-bypassable owner and policy-admin protections",
				builderPayload,
				cedarSource: compiled.cedarSource,
				sqlPredicate: compiled.sqlPredicate,
				status: "PUBLISHED",
				createdById: author.id,
				approvedById: approver.id,
				approvalKind: "FOUR_EYES",
			},
		});
		const simulationId = ids.simulationId;
		await tx.authorizationPolicySimulation.create({
			data: {
				id: simulationId,
				draftId: draft.id,
				actorUserId: approver.id,
				passed: true,
				baselineFingerprint: policyBaselineFingerprint(baselineIds.map((row) => row.id)),
				result: {
					simulationId,
					passed: true,
					warnings: [],
					errors: [],
					evaluatedPrincipalCount: memberCount,
					affectedPrincipalCount: 0,
					wouldLockOutOwners: false,
					decisionChanges: [],
					decisionChangesTruncated: false,
				},
			},
		});
		const version = await tx.authorizationPolicyVersion.create({
			data: {
				id: ids.versionId,
				organizationId: null,
				draftId: draft.id,
				scope: "PLATFORM_GUARDRAIL",
				version: 1,
				cedarSource: compiled.cedarSource,
				sqlPredicate: compiled.sqlPredicate,
				contentHash: sha256Hex(compiled.cedarSource),
				publishedAt: BigInt(now),
				publishedById: approver.id,
			},
		});
		const audit = (
			id: string,
			action: string,
			actorId: string,
			policyIds: string[],
			evaluation: Record<string, string | number | null>,
		): Prisma.AuthorizationAuditCreateInput & { readonly id: string } => ({
			id,
			actorId,
			organizationId: null,
			action,
			resource: POLICY_DRAFT_AUDIT_RESOURCE,
			resourceId: draft.id,
			decision: "ALLOW",
			policyIds,
			evaluation: { ...evaluation, scope: "PLATFORM_GUARDRAIL" },
			// Seeded outside any HTTP request: there is no correlation id.
			requestId: null,
		});
		const rows: readonly (Prisma.AuthorizationAuditCreateInput & { readonly id: string })[] = [
			audit(ids.auditIds.created, POLICY_AUDIT_ACTIONS.draftCreated, author.id, [], { name: draft.name }),
			audit(ids.auditIds.simulated, POLICY_AUDIT_ACTIONS.draftSimulated, approver.id, [], { simulationId, evaluatedPrincipalCount: memberCount, affectedPrincipalCount: 0 }),
			audit(ids.auditIds.published, POLICY_AUDIT_ACTIONS.draftPublished, approver.id, [version.id], {
				version: 1,
				authorUserId: author.id,
				approverUserId: approver.id,
				approvalNote: null,
			}),
		];
		// Upsert on the deterministic ids: audit history is append-only and a re-run must not duplicate it.
		for (const row of rows) {
			await tx.authorizationAudit.upsert({ where: { id: row.id }, create: row, update: {} });
		}
	});
}

export interface SeededOrganizations {
	readonly klOrganization: Organization;
	readonly mlkOrganization: Organization;
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

interface SeedOrganization {
	readonly id: string;
	readonly slug: string;
	readonly displayName: string;
	readonly owner: User;
	readonly locations: readonly SeedLocation[];
	readonly profile: Omit<Prisma.OrganizationMerchantProfileUncheckedCreateInput, "organizationId">;
	readonly features: Prisma.InputJsonObject;
	/** IANA zone the merchant's analytics weeks are cut in (its primary city's zone). */
	readonly timeZone: string;
}

/**
 * Creates the organization, or brings an existing one back to its seed state
 * (upserts — the row and its audit trail are never deleted). The ONE
 * PROVISIONING → ACTIVE lifecycle event is found by its natural key (the
 * organization + transition + reason), created when missing and otherwise
 * brought to its seed correlation id, so a re-run never duplicates it.
 */
async function upsertSeedOrganization(input: SeedOrganization, adminUser: User, now: bigint): Promise<Organization> {
	const organization = await prisma.organization.upsert({
		where: { id: input.id },
		create: { id: input.id, slug: input.slug, displayName: input.displayName, lifecycleState: "ACTIVE", timeZone: input.timeZone },
		update: { slug: input.slug, displayName: input.displayName, lifecycleState: "ACTIVE", timeZone: input.timeZone, isDeleted: false, deletedAt: null },
	});
	const activation = {
		organizationId: input.id,
		fromState: "PROVISIONING",
		toState: "ACTIVE",
		reason: "Seed: organization provisioned",
	} satisfies Prisma.OrganizationLifecycleEventWhereInput;
	const correlationId = seedLifecycleCorrelationId(`${input.id}:activated`);
	const activationEvent = await prisma.organizationLifecycleEvent.findFirst({ where: activation, select: { id: true } });
	if (activationEvent === null) {
		await prisma.organizationLifecycleEvent.create({ data: { ...activation, actorUserId: adminUser.id, correlationId } });
	} else {
		await prisma.organizationLifecycleEvent.update({ where: { id: activationEvent.id }, data: { correlationId } });
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
		// Keyed by (organization, code) — the natural key — so rows from runs that predate the fixed
		// ids (same code, random id) are reconciled in place instead of colliding on the unique index.
		await prisma.organizationLocation.upsert({
			where: { organizationId_code: { organizationId: input.id, code: location.code } },
			create: { id: location.id, organizationId: input.id, ...data },
			update: { ...data, isDeleted: false, deletedAt: null },
		});
	}

	await prisma.organizationMerchantProfile.upsert({
		where: { organizationId: input.id },
		create: { organizationId: input.id, ...input.profile },
		update: input.profile,
	});
	await prisma.tenantPlacement.upsert({
		where: { organizationId: input.id },
		create: { organizationId: input.id, kind: "SHARED", regionCode: "default" },
		update: { kind: "SHARED", regionCode: "default" },
	});
	const entitlementId = deterministicUuid("organization-seed-entitlement", input.id);
	const entitlement = { planCode: "pilot", features: input.features, version: 1, effectiveFrom: now };
	await prisma.organizationEntitlement.upsert({
		where: { id: entitlementId },
		create: { id: entitlementId, organizationId: input.id, ...entitlement },
		update: entitlement,
	});
	return organization;
}

/** Display names the demo members chose for themselves (`null`: the member never set one — the roster shows the full name). */
const SEED_MEMBER_DISPLAY_NAMES = {
	klOwner: "Ahmad (Owner)",
	klCashier: "Lee — Bukit Bintang counter",
	mlkOwner: null,
	mlkCashier: "Kak Mira",
} satisfies Readonly<Record<string, string | null>>;

async function upsertSeedMembership(id: string, organizationId: string, userId: string, role: "OWNER" | "CASHIER", displayName: string | null): Promise<void> {
	await upsertLiveSeedMembership({ id, organizationId, userId, role, displayName });
}

export async function seedOrganizationsAndMerchants(
	adminUser: User,
	klOwner: User,
	mlkOwner: User,
	klCashier: User,
	mlkCashier: User,
	accessRequestUser: User,
	klPendingCashier: User,
): Promise<SeededOrganizations> {
	const now = BigInt(Date.now());

	const klPrimaryAddress = "12 Jalan Bukit Bintang, Kuala Lumpur";
	const klPrimaryPhone = "+60321456789";

	const klOrganization = await upsertSeedOrganization(
		{
			id: ORGANIZATION_SEED_IDS.klOrganization,
			slug: ORGANIZATION_SEED_SLUGS.kl,
			displayName: "Brew & Bean KL",
			owner: klOwner,
			locations: [
				{
					id: ORGANIZATION_SEED_IDS.klLocation,
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
			features: { rewards: true, apiKeys: true, analytics: true },
			timeZone: PILOT_CITY_TIME_ZONES.KUALA_LUMPUR,
		},
		adminUser,
		now,
	);

	const mlkPrimaryAddress = "12 Jalan Bukit Katil, 75450 Melaka";
	const mlkPrimaryPhone = "+6062812345";

	const mlkOrganization = await upsertSeedOrganization(
		{
			id: ORGANIZATION_SEED_IDS.mlkOrganization,
			slug: ORGANIZATION_SEED_SLUGS.mlk,
			displayName: "Jonker Street Kitchen",
			owner: mlkOwner,
			locations: [
				{
					id: ORGANIZATION_SEED_IDS.mlkLocationKatil,
					name: "Jonker Street Kitchen — Bukit Katil",
					code: "bukit-katil",
					addressText: mlkPrimaryAddress,
					city: "MELAKA",
					contactPhone: mlkPrimaryPhone,
					isPrimary: true,
					status: "ACTIVE",
				},
				{
					id: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
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
			features: { rewards: true, apiKeys: true },
			timeZone: PILOT_CITY_TIME_ZONES.MELAKA,
		},
		adminUser,
		now,
	);

	await upsertSeedMembership(ORGANIZATION_SEED_IDS.klOwnerMembership, klOrganization.id, klOwner.id, "OWNER", SEED_MEMBER_DISPLAY_NAMES.klOwner);
	await upsertSeedMembership(ORGANIZATION_SEED_IDS.klCashierMembership, klOrganization.id, klCashier.id, "CASHIER", SEED_MEMBER_DISPLAY_NAMES.klCashier);
	await upsertSeedMembership(ORGANIZATION_SEED_IDS.mlkOwnerMembership, mlkOrganization.id, mlkOwner.id, "OWNER", SEED_MEMBER_DISPLAY_NAMES.mlkOwner);
	await upsertSeedMembership(ORGANIZATION_SEED_IDS.mlkCashierMembership, mlkOrganization.id, mlkCashier.id, "CASHIER", SEED_MEMBER_DISPLAY_NAMES.mlkCashier);

	await prisma.organizationMembershipLocationScope.createMany({
		data: [
			{
				organizationId: klOrganization.id,
				membershipId: ORGANIZATION_SEED_IDS.klOwnerMembership,
				scopeType: "ALL_LOCATIONS",
			},
			{
				organizationId: klOrganization.id,
				membershipId: ORGANIZATION_SEED_IDS.klCashierMembership,
				scopeType: "SELECTED",
				locationId: ORGANIZATION_SEED_IDS.klLocation,
			},
			{
				organizationId: mlkOrganization.id,
				membershipId: ORGANIZATION_SEED_IDS.mlkOwnerMembership,
				scopeType: "ALL_LOCATIONS",
			},
			{
				organizationId: mlkOrganization.id,
				membershipId: ORGANIZATION_SEED_IDS.mlkCashierMembership,
				scopeType: "SELECTED",
				locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
			},
		],
	});

	await prisma.organizationInvitation.create({
		data: {
			id: ORGANIZATION_SEED_IDS.pendingNyonyaInvitation,
			organizationId: mlkOrganization.id,
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

	await prisma.organizationInvitation.create({
		data: {
			id: ORGANIZATION_SEED_IDS.pendingKlTeamInvitation,
			organizationId: klOrganization.id,
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
					organizationId: klOrganization.id,
					locationId: ORGANIZATION_SEED_IDS.klLocation,
				},
			},
		},
	});

	await prisma.organizationAccessRequest.create({
		data: {
			organizationId: mlkOrganization.id,
			userId: accessRequestUser.id,
			status: "PENDING",
			message: "I run a food blog and would like to help promote Jonker Street Kitchen rewards.",
		},
	});

	const windowStart = BigInt(Math.floor(Date.now() / 86_400_000) * 86_400_000);
	const windowEnd = windowStart + BigInt(86_400_000);

	await prisma.organizationQuota.createMany({
		data: [
			{
				organizationId: klOrganization.id,
				quotaKey: "api.requests.daily",
				limitValue: BigInt(10_000),
				usedValue: BigInt(120),
				windowStart,
				windowEnd,
			},
			{
				organizationId: mlkOrganization.id,
				quotaKey: "api.requests.daily",
				limitValue: BigInt(10_000),
				usedValue: BigInt(45),
				windowStart,
				windowEnd,
			},
		],
	});

	await seedRewardHubTenantPolicies(prisma, klOrganization.id, adminUser.id, defaultTenantPolicySeedIds(klOrganization.id));
	await seedRewardHubTenantPolicies(prisma, mlkOrganization.id, adminUser.id, defaultTenantPolicySeedIds(mlkOrganization.id));

	await seedFormerKlCashierMembership(klOrganization.id, klOwner.id, klPendingCashier.id);
	await seedMemberDisplayNameAudits([
		{ organizationId: klOrganization.id, membershipId: ORGANIZATION_SEED_IDS.klOwnerMembership, userId: klOwner.id, displayName: SEED_MEMBER_DISPLAY_NAMES.klOwner },
		{ organizationId: klOrganization.id, membershipId: ORGANIZATION_SEED_IDS.klCashierMembership, userId: klCashier.id, displayName: SEED_MEMBER_DISPLAY_NAMES.klCashier },
		{ organizationId: mlkOrganization.id, membershipId: ORGANIZATION_SEED_IDS.mlkCashierMembership, userId: mlkCashier.id, displayName: SEED_MEMBER_DISPLAY_NAMES.mlkCashier },
	]);

	// Real wrapped data keys (after the tenant policies, so the audit rows carry the live policy version).
	// The Melaka tenant's key has been through a KEK re-wrap (`db:rewrap-tenant-keys`, run by a SuperAdmin).
	const superAdmin = await prisma.user.findFirstOrThrow({ where: { isSuperAdmin: true, isActive: true, isDeleted: false }, orderBy: { email: "asc" }, select: { id: true } });
	await seedTenantEncryptionKeys([
		{ organizationId: klOrganization.id, actorUserId: adminUser.id },
		{ organizationId: mlkOrganization.id, actorUserId: adminUser.id, rewrappedByUserId: superAdmin.id },
	]);

	return { klOrganization, mlkOrganization };
}

/**
 * Alice's removed membership: soft-deleted (never hard-deleted) with its
 * store scope kept for history, plus the organization audit row the removal
 * would have written (actor = the KL owner, live policy version).
 */
async function seedFormerKlCashierMembership(organizationId: string, removedByUserId: string, userId: string): Promise<void> {
	const removedAt = BigInt(Date.now() - KL_FORMER_CASHIER_REMOVED_DAYS_AGO * 24 * 60 * 60 * 1000);
	await prisma.organizationMembership.upsert({
		where: { id: KL_FORMER_CASHIER_MEMBERSHIP_ID },
		create: { id: KL_FORMER_CASHIER_MEMBERSHIP_ID, organizationId, userId, role: "CASHIER", status: "ACTIVE", isDeleted: true, deletedAt: removedAt },
		update: { organizationId, userId, role: "CASHIER", isDeleted: true, deletedAt: removedAt },
	});
	await prisma.organizationMembershipLocationScope.create({
		data: { organizationId, membershipId: KL_FORMER_CASHIER_MEMBERSHIP_ID, scopeType: "SELECTED", locationId: ORGANIZATION_SEED_IDS.klLocation },
	});
	await prisma.organizationAuditLog.upsert({
		where: { id: KL_FORMER_CASHIER_REMOVAL_AUDIT_ID },
		create: {
			id: KL_FORMER_CASHIER_REMOVAL_AUDIT_ID,
			organizationId,
			actorUserId: removedByUserId,
			action: "membership.removed",
			resourceType: "OrganizationMembership",
			resourceId: KL_FORMER_CASHIER_MEMBERSHIP_ID,
			policyVersion: await findActivePolicyVersionInTx(prisma, organizationId),
			createdAt: removedAt,
		},
		update: {},
	});
}

interface SeedMemberDisplayName {
	readonly organizationId: string;
	readonly membershipId: string;
	readonly userId: string;
	readonly displayName: string;
}

/**
 * The organization audit row `PATCH /orgs/:orgSlug/members/me` writes when a
 * member sets their display name (actor = the member, live policy version),
 * one per seeded display name. Keyed by the membership, so a re-run converges.
 */
async function seedMemberDisplayNameAudits(rows: readonly SeedMemberDisplayName[]): Promise<void> {
	for (const row of rows) {
		const auditId = deterministicUuid("organization-seed-audit", `${row.membershipId}:display-name`);
		const audit = {
			organizationId: row.organizationId,
			actorUserId: row.userId,
			action: OWN_DISPLAY_NAME_UPDATED_AUDIT_ACTION,
			resourceType: "OrganizationMembership",
			resourceId: row.membershipId,
			policyVersion: await findActivePolicyVersionInTx(prisma, row.organizationId),
			metadata: { previousDisplayName: null, displayName: row.displayName },
		};
		await prisma.organizationAuditLog.upsert({ where: { id: auditId }, create: { id: auditId, ...audit }, update: audit });
	}
}

export function printOrganizationSeedCredentials(): void {
	seedLog(`
🏢 Organization workspace (merchant portal)
──────────────────────────────────────────────
Brew & Bean KL — brew.owner@kl-rewards.demo / BrewOwner@123
  Primary store: Brew & Bean KL — Bukit Bintang (12 Jalan Bukit Bintang, Kuala Lumpur)
  Canonical:     /orgs/${ORGANIZATION_SEED_SLUGS.kl}/dashboard
  By org id:     /orgs/${ORGANIZATION_SEED_IDS.klOrganization}/dashboard

Jonker Street Kitchen — jonker.owner@melaka-rewards.demo / JonkerOwner@123
  Stores:        Bukit Katil (primary), Bukit Beruang (active), Ayer Keroh (pending approval)
  Canonical:     /orgs/${ORGANIZATION_SEED_SLUGS.mlk}/dashboard
  By org id:     /orgs/${ORGANIZATION_SEED_IDS.mlkOrganization}/dashboard

Pending team invite (Brew & Bean KL → Bukit Bintang cashier)
  Invitee:       alice.kl@kl-rewards.demo / AliceKl@123
  Accept URL:    /team-invite?token=${SEED_TEAM_INVITE_TOKEN_KL_ALICE}

UUID paths redirect to the canonical slug URL after login.
`);
}
