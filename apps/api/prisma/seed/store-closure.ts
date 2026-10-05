import type { OrganizationLocationStatus, OrganizationMembershipStatus, PilotCity, Role } from "@prisma/client";
import { DAY_MS } from "@workspace/shared";

import { findActivePolicyVersionInTx } from "../../src/modules/organization/utils/rewardhub-policy-seed.util";
import { syncStoreForLocation } from "../../src/modules/organization/utils/store-sync.util";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { ORGANIZATION_SEED_IDS } from "./organization-seed-ids";
import { requireRow } from "./require-row";

const CLOSED_STORE_STATUS: OrganizationLocationStatus = "INACTIVE";
const CLOSED_STORE_CITY: PilotCity = "MELAKA";
const STORE_MEMBERSHIP_STATUS: OrganizationMembershipStatus = "ACTIVE";
const STORE_CLOSED_DAYS_AGO = 45;
const STORE_MEMBER_REMOVED_DAYS_AGO = 12;

const CLOSED_STORE_LOCATION_ID = deterministicUuid("store-closure-seed", "mlk-melaka-raya-location");
const CLOSED_STORE_AUDIT_ID = deterministicUuid("store-closure-seed", "mlk-melaka-raya-closed-audit");
const REMOVED_MEMBER_AUDIT_ID = deterministicUuid("store-closure-seed", "mlk-cashier-removed-from-katil-audit");
const CLOSED_STORE_CODE = "melaka-raya-closed";
const CLOSED_STORE_REASON = "Franchise partner went bankrupt; the Taman Melaka Raya outlet was closed permanently.";

/** What the closed-store / removed-member seed wrote (all deterministic, safe to re-run). */
export interface StoreClosureSeedSummary {
	readonly closedStores: number;
	readonly removedStoreMembers: number;
}

/**
 * Seeds what the app writes when a merchant closes a store and when a team
 * manager removes a member from one — through the same invariants:
 *  - a CLOSED store (Jonker Street Kitchen — Taman Melaka Raya): the location and
 *    its mirrored store are soft-deleted with `deleted_by` + `closure_reason`, its
 *    store memberships are soft-deleted, and the closure audit row is written;
 *  - a REMOVED store member (the Jonker cashier, removed from the Bukit Katil
 *    store; they keep Bukit Beruang): a soft-deleted store membership with
 *    `deleted_by`, plus the removal audit row. No scope row remains for it.
 */
export async function seedStoreClosureAndRemoval(storeManagerRole: Role, storeStaffRole: Role): Promise<StoreClosureSeedSummary> {
	const organizationId = ORGANIZATION_SEED_IDS.mlkOrganization;
	const owner = requireRow(
		(await prisma.organizationMembership.findFirst({ where: { organizationId, role: "OWNER", isDeleted: false } })) ?? undefined,
		"Jonker Street Kitchen owner membership",
	);
	const cashier = requireRow(
		(await prisma.organizationMembership.findFirst({ where: { organizationId, role: "CASHIER", isDeleted: false } })) ?? undefined,
		"Jonker Street Kitchen cashier membership",
	);
	const policyVersion = await findActivePolicyVersionInTx(prisma, organizationId);

	const closedAt = Date.now() - STORE_CLOSED_DAYS_AGO * DAY_MS;
	const closedData = {
		name: "Jonker Street Kitchen — Taman Melaka Raya (Closed)",
		addressText: "21 Jalan Melaka Raya 3, Taman Melaka Raya, 75000 Melaka",
		city: CLOSED_STORE_CITY,
		contactPhone: "+6062841111",
		status: CLOSED_STORE_STATUS,
		rejectionReason: null,
		requestedByUserId: owner.userId,
		reviewedByUserId: owner.userId,
		reviewedAt: closedAt - 90 * DAY_MS,
		isPrimary: false,
		closureReason: CLOSED_STORE_REASON,
		isDeleted: true,
		deletedAt: closedAt,
		deletedBy: owner.userId,
		updatedAt: closedAt,
	};
	const location = await prisma.organizationLocation.upsert({
		where: { organizationId_code: { organizationId, code: CLOSED_STORE_CODE } },
		create: { id: CLOSED_STORE_LOCATION_ID, organizationId, code: CLOSED_STORE_CODE, createdAt: closedAt - 120 * DAY_MS, ...closedData },
		update: closedData,
	});
	const store = await syncStoreForLocation(prisma, location);

	for (const member of [
		{ userId: owner.userId, roleId: storeManagerRole.id },
		{ userId: cashier.userId, roleId: storeStaffRole.id },
	]) {
		const removed = { organizationId, storeId: store.id, ...member, status: STORE_MEMBERSHIP_STATUS, isDeleted: true, deletedAt: closedAt, deletedBy: owner.userId };
		await prisma.storeMembership.upsert({
			where: { storeId_userId: { storeId: store.id, userId: member.userId } },
			create: { ...removed, createdAt: closedAt - 100 * DAY_MS },
			update: removed,
		});
	}
	await prisma.organizationAuditLog.upsert({
		where: { id: CLOSED_STORE_AUDIT_ID },
		create: {
			id: CLOSED_STORE_AUDIT_ID,
			organizationId,
			actorUserId: owner.userId,
			action: "organization.location.closed",
			resourceType: "OrganizationLocation",
			resourceId: location.id,
			policyVersion,
			metadata: { reason: CLOSED_STORE_REASON, storeId: store.id, storeMembershipsRemoved: 2, memberScopesRemoved: 0, terminalsRemoved: 0, apiKeysRevoked: 0 },
			createdAt: closedAt,
		},
		update: {},
	});

	const katilStore = requireRow((await prisma.store.findUnique({ where: { locationId: ORGANIZATION_SEED_IDS.mlkLocationKatil } })) ?? undefined, "Bukit Katil store");
	const removedAt = Date.now() - STORE_MEMBER_REMOVED_DAYS_AGO * DAY_MS;
	const removedMembership = {
		organizationId,
		storeId: katilStore.id,
		userId: cashier.userId,
		roleId: storeStaffRole.id,
		status: STORE_MEMBERSHIP_STATUS,
		isDeleted: true,
		deletedAt: removedAt,
		deletedBy: owner.userId,
	};
	await prisma.storeMembership.upsert({
		where: { storeId_userId: { storeId: katilStore.id, userId: cashier.userId } },
		create: { ...removedMembership, createdAt: removedAt - 60 * DAY_MS },
		update: removedMembership,
	});
	await prisma.organizationAuditLog.upsert({
		where: { id: REMOVED_MEMBER_AUDIT_ID },
		create: {
			id: REMOVED_MEMBER_AUDIT_ID,
			organizationId,
			actorUserId: owner.userId,
			action: "membership.removed_from_store",
			resourceType: "OrganizationMembership",
			resourceId: cashier.id,
			policyVersion,
			metadata: { locationId: ORGANIZATION_SEED_IDS.mlkLocationKatil, memberUserId: cashier.userId, allowNoStores: false, remainingStores: 1 },
			createdAt: removedAt,
		},
		update: {},
	});

	return { closedStores: 1, removedStoreMembers: 1 };
}
