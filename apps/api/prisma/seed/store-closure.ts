import type { LocationStatus, MembershipStatus, PilotCity, Role } from "@prisma/client";
import { DAY_MS } from "@workspace/shared";

import { findActivePolicyVersionInTx } from "../../src/contexts/authorization/public-api";
import { syncStoreForLocation } from "../../src/contexts/tenancy/infrastructure/persistence/store-sync";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";
import { requireRow } from "./require-row";

const CLOSED_STORE_STATUS: LocationStatus = "INACTIVE";
const CLOSED_STORE_CITY: PilotCity = "MELAKA";
const STORE_MEMBERSHIP_STATUS: MembershipStatus = "ACTIVE";
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
 *    its mirrored store are soft-deleted with `deletedBy` + `closureReason`, its
 *    store memberships are soft-deleted, and the closure audit row is written;
 *  - a REMOVED store member (the Jonker cashier, removed from the Bukit Katil
 *    store; they keep Bukit Beruang): a soft-deleted store membership with
 *    `deletedBy`, plus the removal audit row. No scope row remains for it.
 */
export async function seedStoreClosureAndRemoval(storeManagerRole: Role, storeStaffRole: Role): Promise<StoreClosureSeedSummary> {
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
	const location = await prisma.location.upsert({
		where: { tenantId_code: { tenantId, code: CLOSED_STORE_CODE } },
		create: { id: CLOSED_STORE_LOCATION_ID, tenantId, code: CLOSED_STORE_CODE, createdAt: closedAt - 120 * DAY_MS, ...closedData },
		update: closedData,
	});
	const store = await syncStoreForLocation(prisma, location);

	for (const member of [
		{ userId: owner.userId, roleId: storeManagerRole.id },
		{ userId: cashier.userId, roleId: storeStaffRole.id },
	]) {
		const removed = { tenantId, storeId: store.id, ...member, status: STORE_MEMBERSHIP_STATUS, isDeleted: true, deletedAt: closedAt, deletedBy: owner.userId };
		await prisma.storeMembership.upsert({
			where: { storeId_userId: { storeId: store.id, userId: member.userId } },
			create: { ...removed, createdAt: closedAt - 100 * DAY_MS },
			update: removed,
		});
	}
	await prisma.tenantAuditLog.upsert({
		where: { id: CLOSED_STORE_AUDIT_ID },
		create: {
			id: CLOSED_STORE_AUDIT_ID,
			tenantId,
			actorUserId: owner.userId,
			action: "tenant.location.closed",
			resourceType: "Location",
			resourceId: location.id,
			policyVersion,
			metadata: { reason: CLOSED_STORE_REASON, storeId: store.id, storeMembershipsRemoved: 2, memberScopesRemoved: 0, terminalsRemoved: 0, apiKeysRevoked: 0 },
			createdAt: closedAt,
		},
		update: {},
	});

	const katilStore = requireRow((await prisma.store.findUnique({ where: { locationId: TENANT_SEED_IDS.mlkLocationKatil } })) ?? undefined, "Bukit Katil store");
	const removedAt = Date.now() - STORE_MEMBER_REMOVED_DAYS_AGO * DAY_MS;
	const removedMembership = {
		tenantId,
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
	await prisma.tenantAuditLog.upsert({
		where: { id: REMOVED_MEMBER_AUDIT_ID },
		create: {
			id: REMOVED_MEMBER_AUDIT_ID,
			tenantId,
			actorUserId: owner.userId,
			action: "membership.removed_from_store",
			resourceType: "Membership",
			resourceId: cashier.id,
			policyVersion,
			metadata: { locationId: TENANT_SEED_IDS.mlkLocationKatil, memberUserId: cashier.userId, allowNoStores: false, remainingStores: 1 },
			createdAt: removedAt,
		},
		update: {},
	});

	return { closedStores: 1, removedStoreMembers: 1 };
}
