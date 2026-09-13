import type { PermissionDetailsResponse } from "@workspace/shared";

export interface PermissionResourceGroup {
	readonly resource: string;
	readonly permissions: readonly PermissionDetailsResponse[];
}

/**
 * Groups effective permissions by resource for hierarchical display. O(n) over
 * permission count; output resources are sorted alphabetically.
 */
export function groupPermissionsByResource(permissions: readonly PermissionDetailsResponse[]): readonly PermissionResourceGroup[] {
	const byResource = new Map<string, PermissionDetailsResponse[]>();
	for (const permission of permissions) {
		const bucket = byResource.get(permission.resource);
		if (bucket === undefined) {
			byResource.set(permission.resource, [permission]);
		} else {
			bucket.push(permission);
		}
	}
	const groups: PermissionResourceGroup[] = [];
	for (const [resource, bucket] of byResource.entries()) {
		const sorted = [...bucket].sort((left, right) => left.action.localeCompare(right.action));
		groups.push({ resource, permissions: sorted });
	}
	groups.sort((left, right) => left.resource.localeCompare(right.resource));
	return groups;
}
