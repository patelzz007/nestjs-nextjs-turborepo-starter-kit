import { TENANT_PERMISSIONS, type PermissionAction, type PermissionPair, type PermissionResource } from "@workspace/shared";

/**
 * Tenant permissions in the words the access screens use (ADR 067): grouped by what they are about, each
 * named by its verb. The grouping is built from `TENANT_PERMISSIONS`, so a permission added there shows
 * up here without a second list.
 */

/** What each tenant permission is about, as an owner reads it. */
const RESOURCE_LABELS: Readonly<Partial<Record<PermissionResource, string>>> = {
	TENANT: "Business profile",
	REWARD: "Rewards",
	REDEMPTION: "Redemptions",
	CLAIM: "Customer claims",
	ANALYTICS: "Analytics",
	LOCATION: "Stores",
	MEMBER: "Team members",
	INVITE: "Invitations",
	ROLE: "Roles",
	SHARE: "Shared records",
	API_KEY: "API keys",
	TERMINAL: "Tills",
	CUSTOMER_BAN: "Customer bans",
	ACCESS_REQUEST: "Access requests",
	KYB: "Business verification",
	SUPPORT_ACCESS: "Support access",
};

const ACTION_LABELS: Readonly<Record<PermissionAction, string>> = {
	CREATE: "Create",
	READ: "View",
	UPDATE: "Edit",
	DELETE: "Delete",
	LIST: "List",
	PUBLISH: "Publish",
	APPROVE: "Approve",
	REJECT: "Reject",
	SUSPEND: "Suspend",
	BAN: "Ban",
	UNBAN: "Unban",
	REACTIVATE: "Reactivate",
	UNLOCK: "Unlock",
	REDEEM: "Redeem",
};

/** "Rewards", or the resource's own name in words when it has no label yet. */
export function resourceLabel(resource: PermissionResource): string {
	return RESOURCE_LABELS[resource] ?? resource.toLowerCase().replaceAll("_", " ");
}

export function actionLabel(action: PermissionAction): string {
	return ACTION_LABELS[action];
}

/** "Rewards · Edit" — one permission on one line. */
export function permissionLabel(permission: PermissionPair): string {
	return `${resourceLabel(permission.resource)} · ${actionLabel(permission.action)}`;
}

/** A stable key for one permission (a form value, a React key). */
export function permissionKey(permission: PermissionPair): string {
	return `${permission.resource}.${permission.action}`;
}

export interface PermissionGroup {
	readonly resource: PermissionResource;
	readonly label: string;
	readonly permissions: readonly PermissionPair[];
}

/** `permissions` grouped by resource, in the order the catalogue lists them. */
export function groupPermissions(permissions: readonly PermissionPair[]): readonly PermissionGroup[] {
	const groups: PermissionGroup[] = [];
	for (const permission of permissions) {
		const group = groups.find((candidate) => candidate.resource === permission.resource);
		if (group === undefined) {
			groups.push({ resource: permission.resource, label: resourceLabel(permission.resource), permissions: [permission] });
		} else {
			groups.splice(groups.indexOf(group), 1, { ...group, permissions: [...group.permissions, permission] });
		}
	}
	return groups;
}

/** Every permission a tenant role or grant can hold, grouped. */
export const TENANT_PERMISSION_GROUPS: readonly PermissionGroup[] = groupPermissions(TENANT_PERMISSIONS);

export function samePermission(a: PermissionPair, b: PermissionPair): boolean {
	return a.action === b.action && a.resource === b.resource;
}
