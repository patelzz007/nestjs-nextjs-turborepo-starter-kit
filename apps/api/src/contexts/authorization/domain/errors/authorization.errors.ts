import { DomainError } from "../../../../platform/domain/errors/domain-error";
import { DomainErrorCodeSchema, type DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/**
 * Every code the authorization context throws. The generic codes (`CONFLICT`, `NOT_FOUND`, `FORBIDDEN`,
 * `VALIDATION_ERROR`, `PERMISSION_DENIED`) are what clients already receive for these failures, so they
 * stay exactly as they were before the move to domain errors.
 */
export const AuthorizationErrorCodeSchema = DomainErrorCodeSchema.extract([
	"PERMISSION_DENIED",
	"FORBIDDEN",
	"CONFLICT",
	"NOT_FOUND",
	"VALIDATION_ERROR",
	"CORRUPT_AGGREGATE_STATE",
	"SUPPORT_ACCESS_APPROVER_NOT_OWNER",
	"SUPPORT_ACCESS_GRANT_NOT_PENDING",
	"SUPPORT_ACCESS_GRANT_NOT_REVOCABLE",
	"TENANT_OWNER_PROTECTED",
	"TENANT_OWNER_REQUIRED",
	"TENANT_SCOPE_ESCALATION",
]);

export type AuthorizationErrorCode = (typeof AuthorizationErrorCodeSchema)["options"][number];

/** The one client-facing message for every refused authorization decision. It never says which rule failed. */
export const PERMISSION_DENIED_MESSAGE = "You do not have permission to perform this action.";

/** Message of an id that names no live row (the id is the caller's own input, so echoing it is safe). */
const RESOURCE_NOT_FOUND_MESSAGE = "The requested resource was not found.";

// ── RBAC: privilege escalation and server-controlled rows ────────────────────

/**
 * A refused authorization decision: the kernel denied the request, a tenant claim was forged, or an RBAC
 * change reached beyond the actor's own privileges (self-escalation, a SuperAdmin target, a permission it
 * does not hold). One uniform envelope that never reveals which rule failed.
 */
export class AccessDeniedError extends DomainError {
	public readonly code: DomainErrorCode = "PERMISSION_DENIED";

	public constructor() {
		super(PERMISSION_DENIED_MESSAGE);
	}
}

/** System roles are server-controlled: no API caller may rename, deactivate, re-parent, re-permission or delete them. */
export class SystemRoleImmutableError extends DomainError {
	public readonly code: DomainErrorCode = "FORBIDDEN";

	public constructor(roleName: string) {
		super(`"${roleName}" is a system role and cannot be modified`);
	}
}

/** System permissions come from the code registry; no API caller may edit or delete them. */
export class SystemPermissionImmutableError extends DomainError {
	public readonly code: DomainErrorCode = "FORBIDDEN";

	public constructor(permissionKey: string) {
		super(`${permissionKey} is a system permission and cannot be modified`);
	}
}

// ── RBAC: conflicts ──────────────────────────────────────────────────────────

/** `Role.name` is unique across soft-deleted rows too. `restorable` adds the hint a create shows. */
export class RoleNameTakenError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(name: string, restorable: boolean) {
		super(restorable ? `Role "${name}" already exists (restore it if it was deleted)` : `Role "${name}" already exists`);
	}
}

/** The `(action, resource, scope)` key is unique across soft-deleted rows too. */
export class PermissionAlreadyExistsError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(permissionKey: string) {
		super(`Permission ${permissionKey} already exists (restore it if it was deleted)`);
	}
}

export class RoleLimitExceededError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(maxRoles: number) {
		super(`A user can have at most ${String(maxRoles)} roles. Reconsider your role design if more are needed.`);
	}
}

/** Removing this role would leave a last-holder-protected system role with no active holder. */
export class ProtectedRoleWithoutHolderError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(roleName: string) {
		super(`"${roleName}" must keep at least one active holder`);
	}
}

/** The user's effective role set would contain both roles of a separation-of-duty rule. */
export class SeparationOfDutyViolationError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(violations: readonly string[]) {
		super(`Role assignment rejected: ${violations.join("; ")}`);
	}
}

/** A direct ALLOW sync listed a permission the user holds a live DENY override for. */
export class AllowDenyConflictError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(deniedCount: number) {
		super(`Permission sync rejected: the user has a DENY override for ${String(deniedCount)} listed permission(s); revoke the override explicitly first`);
	}
}

// ── RBAC: not found ──────────────────────────────────────────────────────────

/** `GET /admin/roles/:id` and `GET /admin/permissions/:id` for an id that names no live row. */
export class AuthorizationResourceNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(resourceId: string) {
		super(RESOURCE_NOT_FOUND_MESSAGE, { resourceId });
	}
}

export class RoleNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(roleId: string) {
		super(`Role ${roleId} not found`);
	}
}

export class DeletedRoleNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(roleId: string) {
		super(`Deleted role ${roleId} not found`);
	}
}

export class PermissionNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(permissionId: string) {
		super(`Permission ${permissionId} not found`);
	}
}

export class DeletedPermissionNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(permissionId: string) {
		super(`Deleted permission ${permissionId} not found`);
	}
}

/** A bulk change named at least one permission that does not exist (or is deleted). */
export class PermissionsNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor() {
		super("One or more permissions were not found");
	}
}

export class RbacTargetUserNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(userId: string) {
		super(`User ${userId} not found`);
	}
}

export class RoleAssignmentNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(roleId: string, userId: string) {
		super(`Role ${roleId} is not assigned to user ${userId}`);
	}
}

export class PermissionOverrideNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(userId: string, permissionId: string) {
		super(`User ${userId} has no direct override for permission ${permissionId}`);
	}
}

/** A platform role the code depends on by name is missing: the reference data was never loaded. */
export class PlatformRoleNotConfiguredError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor(roleName: string) {
		super(`Platform role "${roleName}" is not configured`);
	}
}

// ── Support access ───────────────────────────────────────────────────────────

export class SupportAccessApproverNotOwnerError extends DomainError {
	public readonly code: DomainErrorCode = "SUPPORT_ACCESS_APPROVER_NOT_OWNER";

	public constructor() {
		super("Only an active owner of the tenant may approve support access");
	}
}

export class SupportAccessGrantNotPendingError extends DomainError {
	public readonly code: DomainErrorCode = "SUPPORT_ACCESS_GRANT_NOT_PENDING";

	public constructor() {
		super("Support access grant is not pending approval (already decided, revoked, expired, or requested by you)");
	}
}

export class SupportAccessGrantNotRevocableError extends DomainError {
	public readonly code: DomainErrorCode = "SUPPORT_ACCESS_GRANT_NOT_REVOCABLE";

	public constructor() {
		super("Support access grant is already revoked, expired, or denied");
	}
}

export class SupportAccessGrantNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor() {
		super("Support access grant not found");
	}
}

export class SupportAccessTenantNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "NOT_FOUND";

	public constructor() {
		super("Tenant not found");
	}
}

// ── Persistence integrity ────────────────────────────────────────────────────
