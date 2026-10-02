import type { Permission, Role } from "@prisma/client";

import { seedAbacConditions } from "./abac";
import { seedMerchantCapabilities } from "./capabilities";
import { createPermissions } from "./permissions";
import { assignPermissionsToRoles, assignRoleHierarchy, createRoles } from "./roles";
import { seedLog } from "./seed-log";

export interface ReferenceData {
	readonly permissions: Permission[];
	readonly roles: Role[];
}

/**
 * Reference data every scenario needs before the API can authorize anything:
 * the permission catalog, platform/store roles and their grants, the MERCHANT
 * capability catalog, and the ABAC demo condition. Everything here is upserted,
 * so it is safe to run on top of any existing dataset.
 */
export async function seedReferenceData(): Promise<ReferenceData> {
	seedLog("Creating permissions...");
	const permissions = await createPermissions();
	seedLog(`✅ ${String(permissions.length)} permissions`);

	seedLog("Creating roles...");
	const roles = await createRoles();
	seedLog(`✅ ${String(roles.length)} roles`);

	seedLog("Configuring role hierarchy (flat — no parent links)...");
	await assignRoleHierarchy(roles);
	seedLog("✅ Role hierarchy configured");

	seedLog("Assigning permissions to roles...");
	await assignPermissionsToRoles(roles, permissions);
	seedLog("✅ Role permissions assigned");

	seedLog("Seeding merchant capability catalog...");
	const merchantCapabilitySummary = await seedMerchantCapabilities();
	seedLog(`✅ ${String(merchantCapabilitySummary.definitions)} MERCHANT capability definitions`);

	seedLog("Seeding ABAC demo conditions...");
	await seedAbacConditions(permissions);
	seedLog("✅ ABAC conditions seeded on MANAGE:SYSTEM_SETTINGS");

	return { permissions, roles };
}
