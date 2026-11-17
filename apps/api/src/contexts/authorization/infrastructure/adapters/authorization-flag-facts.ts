import { PermissionActionSchema, PermissionResourceSchema, type PermissionReference } from "@workspace/shared";

import type { SubjectFactSource } from "../../../feature-flags/public-api";
import type { SubjectAuthorizationReadPort } from "../../application/ports/subject-authorization-read.port";

/** The resource whose access opens the admin console: who holds it is platform staff. */
const ADMIN_CONSOLE_RESOURCE = PermissionResourceSchema.enum.ADMIN_DASHBOARD;

async function permissionsOf(grants: Pick<SubjectAuthorizationReadPort, "getUserPermissionDetails">, userId: string): Promise<readonly PermissionReference[]> {
	const details = await grants.getUserPermissionDetails(userId);
	return details.permissions.flatMap((permission) => {
		const action = PermissionActionSchema.safeParse(permission.action);
		const resource = PermissionResourceSchema.safeParse(permission.resource);
		return action.success && resource.success ? [{ action: action.data, resource: resource.data }] : [];
	});
}

/**
 * Authorization's part of the facts feature flag rules read (ADR 087): a person's effective permissions, and
 * whether they are platform staff (they can open the admin console, as `/auth/me`'s `hasAdminAccess` says).
 */
export function authorizationFlagFacts(grants: Pick<SubjectAuthorizationReadPort, "getUserPermissionDetails">): SubjectFactSource {
	return {
		permissions: (userId: string): Promise<readonly PermissionReference[]> => permissionsOf(grants, userId),
		platformStaff: async (userId: string): Promise<boolean> => (await permissionsOf(grants, userId)).some((permission) => permission.resource === ADMIN_CONSOLE_RESOURCE),
	};
}
