import type { ProtectedRoleHolders } from "../../domain/policies/protected-role-holder.policy";
import type { RbacPermissionPair } from "../../domain/policies/rbac-escalation.policy";

/**
 * Hierarchy and holder reads an RBAC mutation needs, bound to its transaction (so they see the state the
 * RBAC advisory lock protects, including the mutation's own writes).
 */
export interface RbacGraphReader {
	/** `roleIds` plus every ancestor, following parent links through deleted and inactive roles alike. */
	withAllAncestors(roleIds: readonly string[]): Promise<ReadonlySet<string>>;
	/** Users holding `roleId` or any role inheriting from it (any depth): everyone a role-level change touches. */
	holdersOfLineage(roleId: string): Promise<string[]>;
	/** Users affected by a change to `permissionId`: direct override holders plus holders of any role assigning it, or inheriting from one. */
	holdersOfPermission(permissionId: string): Promise<string[]>;
	/** `ACTION:RESOURCE` pairs conferred by `roleIds` (live assignments of live permissions). */
	permissionPairsConferredBy(roleIds: readonly string[]): Promise<RbacPermissionPair[]>;
	/** Live directly assigned role ids of `userId`. */
	assignedRoleIds(userId: string): Promise<string[]>;
	/** Names of the active roles among `roleIds` plus every active ancestor (the hierarchy the kernel evaluates). */
	effectiveRoleNames(roleIds: readonly string[]): Promise<ReadonlySet<string>>;
	/** The non-deleted system roles among `roleNames` and their active direct holders. */
	protectedRoleHolders(roleNames: readonly string[]): Promise<ProtectedRoleHolders[]>;
}

/** The transaction-scoped advisory lock that serializes every RBAC mutation (`RBAC_MUTATION_ADVISORY_LOCK_KEY`). */
export interface RbacMutationLock {
	acquire(): Promise<void>;
}
