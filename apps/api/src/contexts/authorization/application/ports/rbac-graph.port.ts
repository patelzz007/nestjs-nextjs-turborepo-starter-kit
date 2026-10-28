import type { ProtectedRoleHolders } from "../../domain/policies/protected-role-holder.policy";
import type { RbacPermissionPair } from "../../domain/policies/rbac-escalation.policy";

/**
 * Holder and role reads an RBAC mutation needs, bound to its transaction (so they see the state the
 * RBAC advisory lock protects, including the mutation's own writes).
 */
export interface RbacGraphReader {
	/** Users holding `roleId`: everyone a role-level change touches (roles are flat — ADR 067). */
	holdersOfRole(roleId: string): Promise<string[]>;
	/** Users affected by a change to `permissionId`: direct override holders plus holders of any role assigning it. */
	holdersOfPermission(permissionId: string): Promise<string[]>;
	/** `ACTION:RESOURCE` pairs conferred by `roleIds` (live assignments of live permissions). */
	permissionPairsConferredBy(roleIds: readonly string[]): Promise<RbacPermissionPair[]>;
	/** Live directly assigned role ids of `userId`. */
	assignedRoleIds(userId: string): Promise<string[]>;
	/** Names of the active, live roles among `roleIds` (the set the kernel evaluates). */
	activeRoleNames(roleIds: readonly string[]): Promise<ReadonlySet<string>>;
	/** The non-deleted system roles among `roleNames` and their active direct holders. */
	protectedRoleHolders(roleNames: readonly string[]): Promise<ProtectedRoleHolders[]>;
}

/** The transaction-scoped advisory lock that serializes every RBAC mutation (`RBAC_MUTATION_ADVISORY_LOCK_KEY`). */
export interface RbacMutationLock {
	acquire(): Promise<void>;
}
