/** Minimum fields required to build a group → resource → action tree. */
export interface PermissionTreeSource {
	readonly id: string;
	readonly action: string;
	readonly resource: string;
	readonly description: string | null;
	readonly group: string | null;
}

export interface PermissionTreeLeaf {
	readonly id: string;
	readonly action: string;
	readonly resource: string;
	readonly description: string | null;
}

export interface PermissionTreeResourceNode {
	readonly resource: string;
	readonly permissions: readonly PermissionTreeLeaf[];
}

export interface PermissionTreeGroupNode {
	readonly group: string;
	readonly resources: readonly PermissionTreeResourceNode[];
}

const UNCATEGORIZED_GROUP = "Uncategorized";

export { isRedundantResourceLabel } from "./permission-label-utils";

/**
 * Builds a three-level permission tree: group → resource → action.
 * Used by the admin user access hierarchy panel.
 */
export function buildPermissionTree(permissions: readonly PermissionTreeSource[]): readonly PermissionTreeGroupNode[] {
	const byGroup = new Map<string, Map<string, PermissionTreeLeaf[]>>();

	for (const permission of permissions) {
		const groupName: string = permission.group ?? UNCATEGORIZED_GROUP;
		let byResource: Map<string, PermissionTreeLeaf[]> | undefined = byGroup.get(groupName);
		if (byResource === undefined) {
			byResource = new Map<string, PermissionTreeLeaf[]>();
			byGroup.set(groupName, byResource);
		}
		let bucket: PermissionTreeLeaf[] | undefined = byResource.get(permission.resource);
		if (bucket === undefined) {
			bucket = [];
			byResource.set(permission.resource, bucket);
		}
		bucket.push({
			id: permission.id,
			action: permission.action,
			resource: permission.resource,
			description: permission.description,
		});
	}

	const groups: PermissionTreeGroupNode[] = [];
	for (const [group, byResource] of byGroup.entries()) {
		const resources: PermissionTreeResourceNode[] = [];
		for (const [resource, bucket] of byResource.entries()) {
			const sortedPermissions = [...bucket].sort((left, right) => left.action.localeCompare(right.action));
			resources.push({ resource, permissions: sortedPermissions });
		}
		resources.sort((left, right) => left.resource.localeCompare(right.resource));
		groups.push({ group, resources });
	}
	groups.sort((left, right) => left.group.localeCompare(right.group));
	return groups;
}
