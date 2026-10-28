import type { MembershipRole, Role } from "@prisma/client";

import { LOCATION_MANAGER_ROLE_NAME, LOCATION_STAFF_ROLE_NAME } from "../../src/contexts/authorization/public-api";
import { prisma } from "./client";
import { seedLocationClosureAndRemoval } from "./location-closure";

export interface LocationRoleSeedSummary {
	/** Live location scope rows that now carry a location role. */
	readonly scopesWithRole: number;
	readonly closedLocations: number;
}

/** Tenant roles that run every location their scope covers. */
const LOCATION_MANAGER_TENANT_ROLES: ReadonlySet<MembershipRole> = new Set<MembershipRole>(["OWNER", "MANAGER"]);

function requireRole(roles: readonly Role[], name: string): Role {
	const role = roles.find((candidate) => candidate.name === name);
	if (role === undefined) {
		throw new Error(`Seed role "${name}" is missing — the reference data was not synced (db:sync-reference-data)`);
	}
	return role;
}

/**
 * Location roles: every live location scope of an active membership carries one —
 * OWNER / MANAGER → "Location Manager" wherever their scope reaches (every location
 * for ALL_LOCATIONS), other members → "Location Staff" at their SELECTED locations.
 */
export async function seedLocationRoles(roles: readonly Role[]): Promise<LocationRoleSeedSummary> {
	const managerRole = requireRole(roles, LOCATION_MANAGER_ROLE_NAME);
	const staffRole = requireRole(roles, LOCATION_STAFF_ROLE_NAME);

	const memberships = await prisma.membership.findMany({ where: { status: "ACTIVE", isDeleted: false }, select: { id: true, role: true } });
	let scopesWithRole = 0;
	for (const membership of memberships) {
		const roleId = LOCATION_MANAGER_TENANT_ROLES.has(membership.role) ? managerRole.id : staffRole.id;
		const updated = await prisma.membershipLocationScope.updateMany({ where: { membershipId: membership.id, isDeleted: false }, data: { roleId } });
		scopesWithRole += updated.count;
	}

	// Last: the closed location and the removed member's scope must not be re-activated by the loop above.
	const closure = await seedLocationClosureAndRemoval(staffRole);

	return { scopesWithRole, closedLocations: closure.closedLocations };
}
