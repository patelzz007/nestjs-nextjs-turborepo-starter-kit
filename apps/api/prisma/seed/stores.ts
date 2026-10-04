import type { OrganizationMembershipRole, Role } from "@prisma/client";

import { syncStoreForLocation } from "../../src/modules/organization/utils/store-sync.util";
import { prisma } from "./client";
import { seedStoreClosureAndRemoval } from "./store-closure";

export interface StoreSeedSummary {
	readonly stores: number;
	readonly memberships: number;
}

/** Organization roles that run every store their location scope covers. */
const STORE_MANAGER_ORGANIZATION_ROLES: ReadonlySet<OrganizationMembershipRole> = new Set<OrganizationMembershipRole>(["OWNER", "ADMIN"]);

function requireRole(roles: readonly Role[], name: string): Role {
	const role = roles.find((candidate) => candidate.name === name);
	if (role === undefined) {
		throw new Error(`Seed role "${name}" is missing — the reference data was not synced (db:sync-reference-data)`);
	}
	return role;
}

/**
 * Stores (spec §35–§36): one store per organization location, plus store
 * memberships derived from the seeded organization memberships —
 * OWNER / ADMIN → "Store Manager" in every store their location scope covers,
 * other members → "Store Staff" in their SELECTED stores.
 */
export async function seedStores(roles: readonly Role[]): Promise<StoreSeedSummary> {
	const storeManagerRole = requireRole(roles, "Store Manager");
	const storeStaffRole = requireRole(roles, "Store Staff");

	const locations = await prisma.organizationLocation.findMany({ orderBy: { createdAt: "asc" } });
	const storeIdByLocationId = new Map<string, string>();
	for (const location of locations) {
		const store = await syncStoreForLocation(prisma, location);
		storeIdByLocationId.set(location.id, store.id);
	}

	const memberships = await prisma.organizationMembership.findMany({
		where: { status: "ACTIVE", isDeleted: false },
		select: { organizationId: true, userId: true, role: true, locationScopes: { select: { scopeType: true, locationId: true } } },
	});

	let membershipCount = 0;
	for (const membership of memberships) {
		const coversAll = membership.locationScopes.some((scope) => scope.scopeType === "ALL_LOCATIONS");
		const coveredLocationIds = locations
			.filter((location) => location.organizationId === membership.organizationId && !location.isDeleted)
			.filter((location) => coversAll || membership.locationScopes.some((scope) => scope.locationId === location.id))
			.map((location) => location.id);
		const roleId = STORE_MANAGER_ORGANIZATION_ROLES.has(membership.role) ? storeManagerRole.id : storeStaffRole.id;

		for (const locationId of coveredLocationIds) {
			const storeId = storeIdByLocationId.get(locationId);
			if (storeId === undefined) {
				continue;
			}
			await prisma.storeMembership.upsert({
				where: { storeId_userId: { storeId, userId: membership.userId } },
				create: { organizationId: membership.organizationId, storeId, userId: membership.userId, roleId },
				update: { roleId, status: "ACTIVE", isDeleted: false, deletedAt: null, deletedBy: null },
			});
			membershipCount += 1;
		}
	}

	// Last: the closed store and the removed store member must not be re-activated by the loops above.
	const closure = await seedStoreClosureAndRemoval(storeManagerRole, storeStaffRole);

	return { stores: locations.length + closure.closedStores, memberships: membershipCount };
}
