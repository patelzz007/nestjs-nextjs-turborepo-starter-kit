import type { TenantAppealStatus, TenantLifecycleState, MembershipRole, Prisma, User } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { assertNever, PILOT_CITY_TIME_ZONES, DAY_MS } from "@workspace/shared";

import { findActivePolicyVersionInTx, seedDefaultTenantPolicies } from "../../src/contexts/authorization/public-api";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { seedLifecycleCorrelationId } from "./lifecycle-correlation";
import { upsertLiveSeedMembership } from "./memberships";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";
import { defaultTenantPolicySeedIds } from "./policy-seed-ids";
import { seedTenantEncryptionKeys } from "./tenant-encryption";

// ---------------------------------------------------------------------------
// Tenant review and lifecycle states — demo rows.
//
// What only the review / deletion flows leave behind, written with the rows and the tenant
// audit entries those services write (`MembershipService.reviewAccessRequest`,
// `LocationService.reviewAdminLocation`, `TenantLifecycleService`):
//
//   access requests   one APPROVED (the owner admitted the requester as a cashier: membership +
//                     store scope created in the same step) and one REJECTED — both with the
//                     reviewer and review time (`reviewedById`, `reviewedAt`)
//   store requests    a store the platform admin REJECTED, with the reason shown to the merchant
//   lifecycle         a tenant whose owner asked for deletion (PENDING_DELETION, the 30-day
//                     grace window running) and one whose grace period elapsed (DELETED, soft-deleted
//                     with its memberships) — neither is used by any e2e suite or demo login
//   deleted user      a former employee's account, soft-deleted
//
// Idempotent: every row has a deterministic id or natural key and is written once (upsert with an
// empty update, or create-if-absent); a re-run on a seeded database writes nothing new.
// ---------------------------------------------------------------------------

const NAMESPACE = "seed.tenant-review-states";
const HOUR_MS = 60 * 60 * 1000;
/** Owner-requested deletion keeps the tenant recoverable for this long (`TenantLifecycleService`). */
const DELETION_GRACE_MS = 30 * DAY_MS;
/** bcrypt cost for seeded secrets (matches the users seeder). */
const SEED_BCRYPT_ROUNDS = 10;

/**
 * Fixed demo clock of the review history (2026-09-15T08:00:00Z). The seed deletes and re-creates the
 * seed tenants' access requests on every run, so their times must not depend on the run time.
 */
const REVIEW_HISTORY_EPOCH_MS = 1_789_459_200_000;

const id = (key: string): string => deterministicUuid(NAMESPACE, key);

/** The two demo accounts whose access requests were reviewed (additional demo users no e2e suite signs in as). */
const APPROVED_REQUESTER_EMAIL = "user-02@example.com";
const REJECTED_REQUESTER_EMAIL = "user-03@example.com";

interface ReviewActors {
	readonly klOwnerId: string;
	readonly mlkOwnerId: string;
	readonly platformAdminId: string;
}

async function requireUserId(email: string): Promise<string> {
	const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
	return user.id;
}

/** One tenant audit row, exactly as `TenantAuditService.recordInTx` writes it, at a fixed time (upserted on its id). */
async function auditRow(
	key: string,
	row: {
		readonly tenantId: string;
		readonly actorUserId: string;
		readonly action: string;
		readonly resourceType: string;
		readonly resourceId: string;
		readonly createdAt: number;
		readonly metadata?: Prisma.InputJsonObject;
	},
): Promise<void> {
	const rowId = id(`audit:${key}`);
	await prisma.tenantAuditLog.upsert({
		where: { id: rowId },
		create: {
			id: rowId,
			tenantId: row.tenantId,
			actorUserId: row.actorUserId,
			action: row.action,
			resourceType: row.resourceType,
			resourceId: row.resourceId,
			policyVersion: await findActivePolicyVersionInTx(prisma, row.tenantId),
			createdAt: row.createdAt,
			...(row.metadata === undefined ? {} : { metadata: row.metadata }),
		},
		update: {},
	});
}

/**
 * The reviewed access requests. Approval creates the CASHIER membership and its store scope in the
 * same step (`reviewAccessRequest`); rejection only closes the request.
 */
async function seedReviewedAccessRequests(actors: ReviewActors, now: number): Promise<number> {
	const approvedUserId = await requireUserId(APPROVED_REQUESTER_EMAIL);
	const rejectedUserId = await requireUserId(REJECTED_REQUESTER_EMAIL);

	const approvedRequestId = id("access-request:approved");
	const approvedMembershipId = id("membership:approved-request");
	const approvedCreatedAt = now - 9 * DAY_MS;
	const approvedReviewedAt = approvedCreatedAt + 20 * HOUR_MS;
	await prisma.tenantAccessRequest.upsert({
		where: { id: approvedRequestId },
		create: {
			id: approvedRequestId,
			tenantId: TENANT_SEED_IDS.klTenant,
			userId: approvedUserId,
			status: "APPROVED",
			message: "I live near the Bukit Bintang cafe and can cover weekday mornings at the counter.",
			reviewedById: actors.klOwnerId,
			reviewedAt: approvedReviewedAt,
			createdAt: approvedCreatedAt,
			updatedAt: approvedReviewedAt,
		},
		update: {},
	});
	const cashier: MembershipRole = "CASHIER";
	await upsertLiveSeedMembership({
		id: approvedMembershipId,
		tenantId: TENANT_SEED_IDS.klTenant,
		userId: approvedUserId,
		role: cashier,
		createdAt: BigInt(approvedReviewedAt),
	});
	await prisma.membershipLocationScope.createMany({
		skipDuplicates: true,
		data: [
			{
				tenantId: TENANT_SEED_IDS.klTenant,
				membershipId: approvedMembershipId,
				scopeType: "SELECTED",
				locationId: TENANT_SEED_IDS.klLocation,
				createdAt: approvedReviewedAt,
			},
		],
	});
	await auditRow("access-request:approved:created", {
		tenantId: TENANT_SEED_IDS.klTenant,
		actorUserId: approvedUserId,
		action: "membership.access_request_created",
		resourceType: "TenantAccessRequest",
		resourceId: approvedRequestId,
		createdAt: approvedCreatedAt,
	});
	await auditRow("access-request:approved:reviewed", {
		tenantId: TENANT_SEED_IDS.klTenant,
		actorUserId: actors.klOwnerId,
		action: "membership.access_request_approved",
		resourceType: "TenantAccessRequest",
		resourceId: approvedRequestId,
		createdAt: approvedReviewedAt,
		metadata: {
			requesterUserId: approvedUserId,
			membershipId: approvedMembershipId,
			role: cashier,
			locationScopeType: "SELECTED",
			locationIds: TENANT_SEED_IDS.klLocation,
		},
	});

	const rejectedRequestId = id("access-request:rejected");
	const rejectedCreatedAt = now - 6 * DAY_MS;
	const rejectedReviewedAt = rejectedCreatedAt + 30 * HOUR_MS;
	await prisma.tenantAccessRequest.upsert({
		where: { id: rejectedRequestId },
		create: {
			id: rejectedRequestId,
			tenantId: TENANT_SEED_IDS.mlkTenant,
			userId: rejectedUserId,
			status: "REJECTED",
			message: "Hi, I would like to manage the loyalty rewards for your Melaka outlets.",
			reviewedById: actors.mlkOwnerId,
			reviewedAt: rejectedReviewedAt,
			createdAt: rejectedCreatedAt,
			updatedAt: rejectedReviewedAt,
		},
		update: {},
	});
	await auditRow("access-request:rejected:created", {
		tenantId: TENANT_SEED_IDS.mlkTenant,
		actorUserId: rejectedUserId,
		action: "membership.access_request_created",
		resourceType: "TenantAccessRequest",
		resourceId: rejectedRequestId,
		createdAt: rejectedCreatedAt,
	});
	await auditRow("access-request:rejected:reviewed", {
		tenantId: TENANT_SEED_IDS.mlkTenant,
		actorUserId: actors.mlkOwnerId,
		action: "membership.access_request_rejected",
		resourceType: "TenantAccessRequest",
		resourceId: rejectedRequestId,
		createdAt: rejectedReviewedAt,
		metadata: { requesterUserId: rejectedUserId },
	});
	return 2;
}

/** A store the Jonker Street Kitchen owner requested and the platform admin rejected (`reviewAdminLocation` with `approve: false`). */
async function seedRejectedLocationRequest(actors: ReviewActors, now: number): Promise<number> {
	const locationId = id("location:mlk-taman-desa-rejected");
	const requestedAt = now - 14 * DAY_MS;
	const reviewedAt = requestedAt + 2 * DAY_MS;
	await prisma.location.upsert({
		where: { tenantId_code: { tenantId: TENANT_SEED_IDS.mlkTenant, code: "taman-desa-rejected" } },
		create: {
			id: locationId,
			tenantId: TENANT_SEED_IDS.mlkTenant,
			name: "Jonker Street Kitchen — Taman Desa (Rejected)",
			code: "taman-desa-rejected",
			addressText: "5 Jalan Taman Desa, 75450 Melaka",
			city: "MELAKA",
			contactPhone: "+6062831111",
			status: "REJECTED",
			rejectionReason: "The address could not be matched to the SSM business registration. Resubmit with a utility bill for 5 Jalan Taman Desa.",
			requestedByUserId: actors.mlkOwnerId,
			reviewedByUserId: actors.platformAdminId,
			reviewedAt,
			createdAt: requestedAt,
			updatedAt: reviewedAt,
		},
		update: {},
	});
	await auditRow("location:taman-desa:requested", {
		tenantId: TENANT_SEED_IDS.mlkTenant,
		actorUserId: actors.mlkOwnerId,
		action: "tenant.location.requested",
		resourceType: "Location",
		resourceId: locationId,
		createdAt: requestedAt,
	});
	await auditRow("location:taman-desa:rejected", {
		tenantId: TENANT_SEED_IDS.mlkTenant,
		actorUserId: actors.platformAdminId,
		action: "tenant.location.rejected",
		resourceType: "Location",
		resourceId: locationId,
		createdAt: reviewedAt,
	});
	return 1;
}

interface LifecycleEventSeed {
	readonly key: string;
	readonly from: TenantLifecycleState | null;
	readonly to: TenantLifecycleState;
	readonly actorUserId: string | null;
	readonly reason: string;
	readonly at: number;
}

interface LifecycleTenant {
	readonly key: string;
	readonly slug: string;
	readonly displayName: string;
	readonly legalName: string;
	readonly category: string;
	readonly registrationNo: string;
	readonly city: "KUALA_LUMPUR" | "MELAKA";
	readonly addressText: string;
	readonly phone: string;
	readonly owner: { readonly email: string; readonly fullName: string; readonly password: string };
	/** Lifecycle the tenant ends in. */
	readonly finalState: Extract<TenantLifecycleState, "PENDING_DELETION" | "DELETED" | "SUSPENDED" | "BANNED">;
	/** When the owner asked for deletion (or the platform suspended the tenant), relative to the seed run. */
	readonly deletionRequestedDaysAgo: number;
}

/** Why the platform suspended the seeded suspended tenant (also the reason on its lifecycle event). */
const SEED_SUSPENSION_REASON = "Repeated customer chargebacks under review by the platform risk team.";

/** Why a super admin banned the seeded banned tenant (also the reason on its lifecycle event). */
const SEED_BAN_REASON = "Sold counterfeit vouchers to customers; confirmed by the platform risk team.";

const LIFECYCLE_TENANTS: readonly LifecycleTenant[] = [
	{
		key: "sunrise-kopitiam",
		slug: "sunrise-kopitiam",
		displayName: "Sunrise Kopitiam",
		legalName: "Sunrise Kopitiam Enterprise",
		category: "cafe",
		registrationNo: "201901034567",
		city: "KUALA_LUMPUR",
		addressText: "28 Jalan Petaling, Kuala Lumpur",
		phone: "+60321450001",
		owner: { email: "owner@sunrise-kopitiam.demo", fullName: "Tan Wei Sunrise", password: "SunriseOwner@123" },
		finalState: "PENDING_DELETION",
		deletionRequestedDaysAgo: 3,
	},
	{
		key: "old-town-bakery",
		slug: "old-town-bakery",
		displayName: "Old Town Bakery",
		legalName: "Old Town Bakery Sdn Bhd",
		category: "bakery",
		registrationNo: "201801045678",
		city: "MELAKA",
		addressText: "9 Jalan Hang Jebat, 75200 Melaka",
		phone: "+6062820002",
		owner: { email: "owner@old-town-bakery.demo", fullName: "Lim Siew Bakery", password: "BakeryOwner@123" },
		finalState: "DELETED",
		// Requested well over the 30-day grace window ago, so the grace period has elapsed.
		deletionRequestedDaysAgo: 45,
	},
	{
		key: "harbour-noodle-house",
		slug: "harbour-noodle-house",
		displayName: "Harbour Noodle House",
		legalName: "Harbour Noodle House Sdn Bhd",
		category: "restaurant",
		registrationNo: "202001056789",
		city: "KUALA_LUMPUR",
		addressText: "3 Jalan Pelabuhan, Kuala Lumpur",
		phone: "+60321450003",
		owner: { email: "owner@harbour-noodle-house.demo", fullName: "Wong Mei Harbour", password: "HarbourOwner@123" },
		// Suspended by the platform 10 days ago; one appeal was rejected, a second one waits for review.
		finalState: "SUSPENDED",
		deletionRequestedDaysAgo: 10,
	},
	{
		key: "lucky-gold-traders",
		slug: "lucky-gold-traders",
		displayName: "Lucky Gold Traders",
		legalName: "Lucky Gold Traders Enterprise",
		category: "retail",
		registrationNo: "202101067890",
		city: "MELAKA",
		addressText: "41 Jalan Tukang Emas, 75200 Melaka",
		phone: "+6062820004",
		owner: { email: "owner@lucky-gold-traders.demo", fullName: "Goh Kim Lucky", password: "LuckyOwner@123" },
		// Banned by a super admin 5 days ago: no appeal, no reactivation.
		finalState: "BANNED",
		deletionRequestedDaysAgo: 5,
	},
];

/**
 * A tenant that went through the deletion flow: provisioned and activated, then the owner
 * requested deletion (`requestDeletion`: PENDING_DELETION + `deletionGraceEndsAt`); for a DELETED
 * one the grace period elapsed and the tenant was soft-deleted (`deletedAt`) together with
 * its memberships. Complete tenant: profile, placement, store, policy, data key.
 */
async function seedLifecycleTenant(spec: LifecycleTenant, platformAdminId: string, now: number): Promise<void> {
	const tenantId = id(`tenant:${spec.key}`);
	const deleted = spec.finalState === "DELETED";
	const suspended = spec.finalState === "SUSPENDED";
	const banned = spec.finalState === "BANNED";
	const provisionedAt = now - (spec.deletionRequestedDaysAgo + 120) * DAY_MS;
	const activatedAt = provisionedAt + 2 * DAY_MS;
	const deletionRequestedAt = now - spec.deletionRequestedDaysAgo * DAY_MS;
	const graceEndsAt = deletionRequestedAt + DELETION_GRACE_MS;
	const deletedAt = graceEndsAt + HOUR_MS;

	const ownerId = id(`user:${spec.key}:owner`);
	const owner = await prisma.user.upsert({
		where: { email: spec.owner.email },
		create: {
			id: ownerId,
			email: spec.owner.email,
			fullName: spec.owner.fullName,
			passwordHash: await bcrypt.hash(spec.owner.password, SEED_BCRYPT_ROUNDS),
			isActive: true,
			emailVerifiedAt: provisionedAt,
			createdAt: provisionedAt,
		},
		update: {},
	});

	await prisma.tenant.upsert({
		where: { id: tenantId },
		create: {
			id: tenantId,
			slug: spec.slug,
			displayName: spec.displayName,
			lifecycleState: spec.finalState,
			timeZone: PILOT_CITY_TIME_ZONES[spec.city],
			deletionGraceEndsAt: suspended || banned ? null : graceEndsAt,
			isDeleted: deleted,
			deletedAt: deleted ? deletedAt : null,
			createdAt: provisionedAt,
			updatedAt: deleted ? deletedAt : deletionRequestedAt,
		},
		update: {},
	});
	await prisma.tenantMerchantProfile.upsert({
		where: { tenantId },
		create: {
			tenantId,
			legalName: spec.legalName,
			category: spec.category,
			addressText: spec.addressText,
			city: spec.city,
			kybStatus: "APPROVED",
			kybFields: { registrationNo: spec.registrationNo },
			contactEmail: spec.owner.email,
			contactPhone: spec.phone,
			createdAt: provisionedAt,
			updatedAt: activatedAt,
		},
		update: {},
	});
	await prisma.tenantPlacement.upsert({ where: { tenantId }, create: { tenantId, kind: "SHARED", regionCode: "default", createdAt: provisionedAt }, update: {} });
	const locationId = id(`location:${spec.key}:primary`);
	await prisma.location.upsert({
		where: { tenantId_code: { tenantId, code: "primary" } },
		create: {
			id: locationId,
			tenantId,
			name: `${spec.displayName} — Main`,
			code: "primary",
			addressText: spec.addressText,
			city: spec.city,
			contactPhone: spec.phone,
			status: "ACTIVE",
			requestedByUserId: owner.id,
			reviewedByUserId: platformAdminId,
			reviewedAt: activatedAt,
			isPrimary: true,
			isDeleted: deleted,
			deletedAt: deleted ? deletedAt : null,
			deletedBy: deleted ? platformAdminId : null,
			closureReason: deleted ? "Tenant deleted after the deletion grace period" : null,
			createdAt: provisionedAt,
			updatedAt: activatedAt,
		},
		update: {},
	});

	const membershipId = id(`membership:${spec.key}:owner`);
	await prisma.membership.upsert({
		where: { id: membershipId },
		create: {
			id: membershipId,
			tenantId,
			userId: owner.id,
			role: "OWNER",
			status: "ACTIVE",
			isDeleted: deleted,
			deletedAt: deleted ? deletedAt : null,
			createdAt: activatedAt,
			updatedAt: deleted ? deletedAt : activatedAt,
		},
		update: {},
	});
	// The unique key (membership, location) cannot dedupe an ALL_LOCATIONS row (NULL location): replace this seed membership's scope.
	await prisma.membershipLocationScope.deleteMany({ where: { membershipId } });
	await prisma.membershipLocationScope.create({ data: { tenantId, membershipId, scopeType: "ALL_LOCATIONS", createdAt: activatedAt } });

	// Tenant policy + data key, as provisioning creates them (the key is created once; a re-run keeps it).
	await seedDefaultTenantPolicies(prisma, tenantId, platformAdminId, defaultTenantPolicySeedIds(tenantId));
	await seedTenantEncryptionKeys([{ tenantId, actorUserId: platformAdminId }]);

	const events: LifecycleEventSeed[] = [
		{ key: "provisioned", from: null, to: "PROVISIONING", actorUserId: platformAdminId, reason: "Platform admin invite created", at: provisionedAt },
		{ key: "activated", from: "PROVISIONING", to: "ACTIVE", actorUserId: owner.id, reason: "Onboarding complete", at: activatedAt },
		finalLifecycleEvent(spec.finalState, platformAdminId, owner.id, deletionRequestedAt),
	];
	if (deleted) {
		events.push({ key: "deleted", from: "PENDING_DELETION", to: "DELETED", actorUserId: null, reason: "Deletion grace period elapsed", at: deletedAt });
	}
	for (const event of events) {
		const eventId = id(`lifecycle:${spec.key}:${event.key}`);
		const correlationId = seedLifecycleCorrelationId(`${spec.key}:${event.key}`);
		await prisma.tenantLifecycleEvent.upsert({
			where: { id: eventId },
			create: {
				id: eventId,
				tenantId,
				fromState: event.from,
				toState: event.to,
				actorUserId: event.actorUserId,
				reason: event.reason,
				correlationId,
				createdAt: event.at,
			},
			update: { correlationId },
		});
	}
	await auditRow(`${spec.key}:provisioned`, {
		tenantId,
		actorUserId: platformAdminId,
		action: "tenant.provisioned",
		resourceType: "Tenant",
		resourceId: tenantId,
		createdAt: provisionedAt,
		metadata: { source: "admin_merchant_invite" },
	});
	await auditRow(`${spec.key}:activated`, {
		tenantId,
		actorUserId: owner.id,
		action: "tenant.activated",
		resourceType: "Tenant",
		resourceId: tenantId,
		createdAt: activatedAt,
	});
	if (suspended) {
		await auditRow(`${spec.key}:suspended`, {
			tenantId,
			actorUserId: platformAdminId,
			action: "tenant.suspended",
			resourceType: "Tenant",
			resourceId: tenantId,
			createdAt: deletionRequestedAt,
			metadata: { from: "ACTIVE", to: "SUSPENDED", reason: SEED_SUSPENSION_REASON },
		});
		await seedSuspensionAppeals(spec.key, tenantId, owner.id, platformAdminId, deletionRequestedAt);
	}
	if (banned) {
		await auditRow(`${spec.key}:banned`, {
			tenantId,
			actorUserId: platformAdminId,
			action: "tenant.banned",
			resourceType: "Tenant",
			resourceId: tenantId,
			createdAt: deletionRequestedAt,
			metadata: { from: "ACTIVE", to: "BANNED", reason: SEED_BAN_REASON, closedAppealId: null },
		});
	}
}

/** The event that put a lifecycle tenant in its final state: a suspension, a ban, or the owner's deletion request. */
function finalLifecycleEvent(finalState: LifecycleTenant["finalState"], platformAdminId: string, ownerId: string, at: number): LifecycleEventSeed {
	switch (finalState) {
		case "SUSPENDED":
			return { key: "suspended", from: "ACTIVE", to: "SUSPENDED", actorUserId: platformAdminId, reason: SEED_SUSPENSION_REASON, at };
		case "BANNED":
			return { key: "banned", from: "ACTIVE", to: "BANNED", actorUserId: platformAdminId, reason: SEED_BAN_REASON, at };
		case "PENDING_DELETION":
		case "DELETED":
			return { key: "deletion-requested", from: "ACTIVE", to: "PENDING_DELETION", actorUserId: ownerId, reason: "Owner requested deletion", at };
		default:
			return assertNever(finalState, "lifecycle tenant final state");
	}
}

interface SeededAppeal {
	readonly id: string;
	readonly message: string;
	readonly status: TenantAppealStatus;
	readonly reviewedByUserId: string | null;
	readonly reviewedAt: number | null;
	readonly reviewNote: string | null;
	readonly createdAt: number;
}

/**
 * The suspended tenant's appeals, as `POST /tenants/:tenantSlug/lifecycle/appeals` and the admin review
 * write them: a first appeal the platform REJECTED with a note, and a second one still PENDING.
 */
async function seedSuspensionAppeals(key: string, tenantId: string, ownerId: string, platformAdminId: string, suspendedAt: number): Promise<void> {
	const rejectedAt = suspendedAt + 3 * DAY_MS;
	const appeals: readonly SeededAppeal[] = [
		{
			id: id(`appeal:${key}:rejected`),
			message: "We have refunded every disputed order and changed our card terminal provider. Please reinstate our store.",
			status: "REJECTED",
			reviewedByUserId: platformAdminId,
			reviewedAt: rejectedAt,
			reviewNote: "Two new chargebacks arrived after the refunds; we will look again once the dispute rate is under 1%.",
			createdAt: suspendedAt + DAY_MS,
		},
		{
			id: id(`appeal:${key}:pending`),
			message: "Our dispute rate has been 0.4% for the last week; statements attached to the support ticket.",
			status: "PENDING",
			reviewedByUserId: null,
			reviewedAt: null,
			reviewNote: null,
			createdAt: rejectedAt + 4 * DAY_MS,
		},
	];
	for (const appeal of appeals) {
		const row = { tenantId, submittedByUserId: ownerId, ...appeal, updatedAt: appeal.reviewedAt ?? appeal.createdAt };
		await prisma.tenantSuspensionAppeal.upsert({ where: { id: appeal.id }, create: row, update: row });
		await auditRow(`${key}:appeal:${appeal.status}`, {
			tenantId,
			actorUserId: ownerId,
			action: "tenant.suspension.appealed",
			resourceType: "TenantSuspensionAppeal",
			resourceId: appeal.id,
			createdAt: appeal.createdAt,
			metadata: { message: appeal.message },
		});
	}
}

/** A former employee's account, soft-deleted: inactive, with the time it was removed. No e2e suite signs in as it. */
async function seedDeletedUser(now: number): Promise<void> {
	const removedAt = now - 60 * DAY_MS;
	await prisma.user.upsert({
		where: { email: "former.employee@example.com" },
		create: {
			id: id("user:former-employee"),
			email: "former.employee@example.com",
			fullName: "Former Employee",
			passwordHash: await bcrypt.hash(id("password:former-employee"), SEED_BCRYPT_ROUNDS),
			isActive: false,
			isDeleted: true,
			deletedAt: removedAt,
			emailVerifiedAt: removedAt - 200 * DAY_MS,
			lastLoginAt: removedAt - DAY_MS,
			createdAt: removedAt - 200 * DAY_MS,
			updatedAt: removedAt,
		},
		update: {},
	});
}

/** A customer a platform admin banned for fraud: inactive, with the ban's time, admin and reason. No e2e suite signs in as it. */
async function seedBannedUser(platformAdminId: string, now: number): Promise<void> {
	const bannedAt = now - 9 * DAY_MS;
	const ban = { isActive: false, bannedAt, bannedByUserId: platformAdminId, banReason: "Repeated chargeback fraud reported by three merchants." };
	await prisma.user.upsert({
		where: { email: "banned.customer@example.com" },
		create: {
			id: id("user:banned-customer"),
			email: "banned.customer@example.com",
			fullName: "Banned Customer",
			passwordHash: await bcrypt.hash(id("password:banned-customer"), SEED_BCRYPT_ROUNDS),
			...ban,
			tokenVersion: 1,
			emailVerifiedAt: bannedAt - 120 * DAY_MS,
			lastLoginAt: bannedAt - DAY_MS,
			createdAt: bannedAt - 120 * DAY_MS,
			updatedAt: bannedAt,
		},
		update: ban,
	});
}

export interface TenantReviewStatesSummary {
	readonly reviewedAccessRequests: number;
	readonly rejectedLocationRequests: number;
	readonly lifecycleTenants: number;
	readonly deletedUsers: number;
	readonly bannedUsers: number;
}

export async function seedTenantReviewStates(platformAdmin: Pick<User, "id">): Promise<TenantReviewStatesSummary> {
	const now = Date.now();
	const actors: ReviewActors = {
		klOwnerId: await requireUserId("brew.owner@kl-rewards.demo"),
		mlkOwnerId: await requireUserId("jonker.owner@melaka-rewards.demo"),
		platformAdminId: platformAdmin.id,
	};
	const reviewedAccessRequests = await seedReviewedAccessRequests(actors, REVIEW_HISTORY_EPOCH_MS);
	const rejectedLocationRequests = await seedRejectedLocationRequest(actors, REVIEW_HISTORY_EPOCH_MS);
	for (const spec of LIFECYCLE_TENANTS) {
		await seedLifecycleTenant(spec, platformAdmin.id, now);
	}
	await seedDeletedUser(now);
	await seedBannedUser(platformAdmin.id, now);
	return { reviewedAccessRequests, rejectedLocationRequests, lifecycleTenants: LIFECYCLE_TENANTS.length, deletedUsers: 1, bannedUsers: 1 };
}
