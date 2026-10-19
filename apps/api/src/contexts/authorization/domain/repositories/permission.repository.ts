import type { PermissionAggregate, PermissionState } from "../aggregates/permission.aggregate";
import type { RbacPermissionPair } from "../policies/rbac-escalation.policy";

/** The permission catalog, bound to one RBAC transaction. */
export interface PermissionRepository {
	findLive(permissionId: string): Promise<PermissionAggregate | null>;
	/** Deleted or not (restore). */
	findIncludingDeleted(permissionId: string): Promise<PermissionAggregate | null>;
	/** Any row, deleted or not, for the GLOBAL pair: the `(action, resource, scope)` key covers soft-deleted rows. */
	existsForPair(pair: RbacPermissionPair): Promise<boolean>;
	/** How many of `permissionIds` name live permissions. */
	countLive(permissionIds: readonly string[]): Promise<number>;
	/** `ACTION:RESOURCE` pairs of the live permissions among `permissionIds`. */
	findLivePairs(permissionIds: readonly string[]): Promise<RbacPermissionPair[]>;
	save(permission: PermissionAggregate): Promise<PermissionState>;
}
