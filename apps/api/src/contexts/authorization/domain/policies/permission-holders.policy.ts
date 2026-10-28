/** The grants that decide who holds one permission, each a list of user ids. */
export interface PermissionHolderGrants {
	/** Holders of a role (directly or as a location role) that confers the permission. */
	readonly roleHolders: readonly string[];
	/** Users with a live, unexpired direct ALLOW override of it. */
	readonly directAllow: readonly string[];
	/** Users with a live, unexpired direct DENY override of it: a deny beats every allow. */
	readonly directDeny: readonly string[];
	/** Active SuperAdmins: they hold every platform permission and no override takes it away. */
	readonly superAdmins: readonly string[];
	/** The accounts that may hold anything at all (live and active); everyone else is dropped. */
	readonly activeUsers: readonly string[];
}

/** The holders, each once, in a stable order (SuperAdmins first, then by grant). */
export function resolvePermissionHolders(grants: PermissionHolderGrants): readonly string[] {
	const active = new Set<string>(grants.activeUsers);
	const denied = new Set<string>(grants.directDeny);
	const granted = [...grants.roleHolders, ...grants.directAllow].filter((userId) => !denied.has(userId));
	return [...new Set<string>([...grants.superAdmins, ...granted])].filter((userId) => active.has(userId));
}
