import type { EpochMs } from "@workspace/shared";

import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Every action written to `PermissionAuditLog`. */
export type AuthorizationAuditAction =
	| "ROLE_CREATED"
	| "ROLE_UPDATED"
	| "ROLE_DELETED"
	| "ROLE_RESTORED"
	| "ROLE_PARENT_SET"
	| "ROLE_PERMISSIONS_SYNCED"
	| "ROLE_ASSIGNED"
	| "ROLE_ASSIGNED_AT_PROVISIONING"
	| "ROLE_REMOVED"
	| "USER_ROLES_SYNCED"
	| "PERMISSION_CREATED"
	| "PERMISSION_UPDATED"
	| "PERMISSION_DELETED"
	| "PERMISSION_RESTORED"
	| "PERMISSION_GRANTED"
	| "PERMISSION_REVOKED"
	| "PERMISSION_EXPIRED"
	| "USER_PERMISSIONS_SYNCED"
	| "SUPER_ADMIN_BYPASS"
	| "SUPER_ADMIN_BOOTSTRAPPED"
	| "REFERENCE_DATA_SYNCED";

/**
 * Who performed the change. A user is identified by their `User.id`; a scheduled job by the allowlisted
 * system operation it ran under, never by a placeholder such as `"system"`.
 */
export type PermissionAuditActor = { readonly kind: "USER"; readonly userId: string } | { readonly kind: "SYSTEM_OPERATION"; readonly operation: SystemOperationName };

/** An audit row a mutation asks for; the RBAC mutation scope stamps the actor. */
export interface PermissionAuditDraft {
	readonly action: AuthorizationAuditAction;
	readonly targetUserId?: string;
	readonly targetRoleId?: string;
	readonly permissionId?: string;
	/** The applied change (JSON). Never secrets. */
	readonly detail?: string;
}

export interface PermissionAuditEntry extends PermissionAuditDraft {
	readonly actor: PermissionAuditActor;
}

/**
 * Appends to `PermissionAuditLog` (bypass-only) on the mutation's transaction, stamping the request's
 * correlation id and impersonator. A failed insert propagates: an RBAC change that cannot be audited
 * does not happen.
 */
export interface PermissionAuditWriter {
	append(entry: PermissionAuditEntry): Promise<void>;
	/** Soft-delete live rows created before `cutoff` (retention). @returns how many were retired. */
	retireCreatedBefore(cutoff: EpochMs, now: EpochMs): Promise<number>;
}
