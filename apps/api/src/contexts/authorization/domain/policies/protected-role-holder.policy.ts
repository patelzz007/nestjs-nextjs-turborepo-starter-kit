import { ProtectedRoleWithoutHolderError } from "../errors/authorization.errors";

/** A last-holder-protected system role and how many active, non-deleted users still hold it directly. */
export interface ProtectedRoleHolders {
	readonly roleId: string;
	readonly roleName: string;
	readonly activeHolders: number;
}

/**
 * After removing `removedRoleIds` from someone, every protected system role among them must still have
 * an active holder (`LAST_HOLDER_PROTECTED_ROLE_NAMES`). The counts are read after the write, inside the
 * RBAC lock, so no concurrent change can remove the last other holder in between.
 */
export function assertProtectedRolesKeepAHolder(removedRoleIds: readonly string[], protectedRoles: readonly ProtectedRoleHolders[]): void {
	for (const role of protectedRoles) {
		if (removedRoleIds.includes(role.roleId) && role.activeHolders === 0) {
			throw new ProtectedRoleWithoutHolderError(role.roleName);
		}
	}
}
