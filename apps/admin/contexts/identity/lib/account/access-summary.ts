// What the signed-in admin's permissions add up to, for the profile's access
// panel: how many there are and the areas (permission groups) they cover.

import type { PermissionDetailsResponse } from "@workspace/shared";

export interface AccessSummary {
	readonly permissionCount: number;
	/** The permission groups, each once, in alphabetical order; ungrouped permissions add none. */
	readonly areas: readonly string[];
}

export function summarizeAccess(permissions: readonly PermissionDetailsResponse[]): AccessSummary {
	const areas = new Set<string>();
	for (const permission of permissions) {
		if (permission.group !== null && permission.group.length > 0) {
			areas.add(permission.group);
		}
	}
	return { permissionCount: permissions.length, areas: [...areas].sort((left: string, right: string): number => left.localeCompare(right)) };
}
