import type { LocationScopeType, LocationStatus, PilotCity, Role } from "@prisma/client";
import { DAY_MS } from "@workspace/shared";

import { findActivePolicyVersionInTx } from "../../src/contexts/authorization/public-api";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";
import { requireRow } from "./require-row";

const CLOSED_LOCATION_STATUS: LocationStatus = "INACTIVE";
const REMOVED_SCOPE_TYPE: LocationScopeType = "SELECTED";
const CLOSED_LOCATION_CITY: PilotCity = "MELAKA";
const LOCATION_CLOSED_DAYS_AGO = 45;
const LOCATION_MEMBER_REMOVED_DAYS_AGO = 12;

const CLOSED_LOCATION_ID = deterministicUuid("store-closure-seed", "mlk-melaka-raya-location");
const CLOSED_LOCATION_AUDIT_ID = deterministicUuid("store-closure-seed", "mlk-melaka-raya-closed-audit");
const REMOVED_MEMBER_AUDIT_ID = deterministicUuid("store-closure-seed", "mlk-cashier-removed-from-katil-audit");
const CLOSED_LOCATION_SCOPE_ID = deterministicUuid("store-closure-seed", "mlk-cashier-melaka-raya-scope");
const REMOVED_MEMBER_SCOPE_ID = deterministicUuid("store-closure-seed", "mlk-cashier-katil-scope");
const CLOSED_LOCATION_CODE = "melaka-raya-closed";
const CLOSED_LOCATION_REASON = "Franchise partner went bankrupt; the Taman Melaka Raya outlet was closed permanently.";

/** What the closed-location / removed-member seed wrote (all deterministic, safe to re-run). */
export interface LocationClosureSeedSummary {
	readonly closedLocations: number;
	readonly removedLocationMembers: number;
}

/**
 * Seeds what the app writes when a merchant closes a store and when a team
 * manager removes a member from one — through the same invariants:
 *  - a CLOSED location (Jonker Street Kitchen — Taman Melaka Raya): soft-deleted
 *    with `deletedBy` + `closureReason`; the cashier's SELECTED scope row there
 *    (with its Location Staff role) is soft-deleted, and the closure audit row is written;
 *  - a REMOVED location member (the Jonker cashier, removed from the Bukit Katil
 *    store; they keep Bukit Beruang): a soft-deleted SELECTED scope row with
 *    `deletedBy`, plus the removal audit row.
 */
export async function seedLocationClosureAndRemoval(staffRole: Role): Promise<LocationClosureSeedSummary> {
	const tenantId = TENANT_SEED_IDS.mlkTenant;
	const owner = requireRow(
		(await prisma.membership.findFirst({ where: { tenantId, role: "OWNER", isDeleted: false } })) ?? undefined,
		"Jonker Street Kitchen owner membership",
	);
	const cashier = requireRow(
		(await prisma.membership.findFirst({ where: { tenantId, role: "CASHIER", isDeleted: false } })) ?? undefined,
		"Jonker Street Kitchen cashier membership",
	);
	const policyVersion = await findActivePolicyVersionInTx(prisma, tenantId);

	const closedAt = Date.now() - LOCATION_CLOSED_DAYS_AGO * DAY_MS;
	const closedData = {
		name: "Jonker Street Kitchen — Taman Melaka Raya (Closed)",
		addressText: "21 Jalan Melaka Raya 3, Taman Melaka Raya, 75000 Melaka",
		city: CLOSED_LOCATION_CITY,
		contactPhone: "+6062841111",
		status: CLOSED_LOCATION_STATUS,
		rejectionReason: null,
		requestedByUserId: owner.userId,
		reviewedByUserId: owner.userId,
		reviewedAt: closedAt - 90 * DAY_MS,
		isPrimary: false,
		closureReason: CLOSED_LOCATION_REASON,
		isDeleted: true,
		deletedAt: closedAt,
		deletedBy: owner.userId,
		updatedAt: closedAt,
	};
	const location = await prisma.location.upsert({
		where: { tenantId_code: { tenantId, code: CLOSED_LOCATION_CODE } },
		create: { id: CLOSED_LOCATION_ID, tenantId, code: CLOSED_LOCATION_CODE, createdAt: closedAt - 120 * DAY_MS, ...closedData },
		update: closedData,
	});
	await upsertRemovedScope(CLOSED_LOCATION_SCOPE_ID, { tenantId, membershipId: cashier.id, locationId: location.id, roleId: staffRole.id }, closedAt, owner.userId);
	await prisma.tenantAuditLog.upsert({
		where: { id: CLOSED_LOCATION_AUDIT_ID },
		create: {
			id: CLOSED_LOCATION_AUDIT_ID,
			tenantId,
			actorUserId: owner.userId,
			action: "tenant.location.closed",
			resourceType: "Location",
			resourceId: location.id,
			policyVersion,
			metadata: { reason: CLOSED_LOCATION_REASON, memberScopesRemoved: 1, terminalsRemoved: 0, apiKeysRevoked: 0 },
			createdAt: closedAt,
		},
		update: {},
	});

	const removedAt = Date.now() - LOCATION_MEMBER_REMOVED_DAYS_AGO * DAY_MS;
	await upsertRemovedScope(
		REMOVED_MEMBER_SCOPE_ID,
		{ tenantId, membershipId: cashier.id, locationId: TENANT_SEED_IDS.mlkLocationKatil, roleId: staffRole.id },
		removedAt,
		owner.userId,
	);
	await prisma.tenantAuditLog.upsert({
		where: { id: REMOVED_MEMBER_AUDIT_ID },
		create: {
			id: REMOVED_MEMBER_AUDIT_ID,
			tenantId,
			actorUserId: owner.userId,
			action: "membership.removed_from_location",
			resourceType: "Membership",
			resourceId: cashier.id,
			policyVersion,
			metadata: { locationId: TENANT_SEED_IDS.mlkLocationKatil, memberUserId: cashier.userId, allowNoLocations: false, remainingStores: 1 },
			createdAt: removedAt,
		},
		update: {},
	});

	return { closedLocations: 1, removedLocationMembers: 1 };
}

interface RemovedScope {
	readonly tenantId: string;
	readonly membershipId: string;
	readonly locationId: string;
	readonly roleId: string;
}

/** A SELECTED scope row soft-deleted at `removedAt` by `removedBy` (the location role it carried stays on the row as history). */
async function upsertRemovedScope(id: string, scope: RemovedScope, removedAt: number, removedBy: string): Promise<void> {
	const removed = { ...scope, scopeType: REMOVED_SCOPE_TYPE, isDeleted: true, deletedAt: removedAt, deletedBy: removedBy, updatedAt: removedAt };
	await prisma.membershipLocationScope.upsert({
		where: { id },
		create: { id, ...removed, createdAt: removedAt - 60 * DAY_MS },
		update: removed,
	});
}
