import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/**
 * Attaches a platform role to an account created IN THE CALLER'S TRANSACTION (signup, invite
 * registration, merchant onboarding, the SuperAdmin bootstrap), writing the
 * `ROLE_ASSIGNED_AT_PROVISIONING` audit row on that transaction too (D14).
 *
 * No session revocation and no cache invalidation: the account was created in the same transaction, so
 * it has no sessions, no cached authorization and no tokens yet. Separation-of-duty rules still apply.
 * The caller owns the transaction (and its system operation) and has authorized the provisioning flow.
 *
 * Built per transaction by `createAuthorizationTransactionalPorts(db)`.
 */
export interface DefaultRoleAssignmentPort {
	/**
	 * The default consumer role (`User`). The account is self-provisioned, so it is its own audited actor.
	 * @throws PlatformRoleNotConfiguredError when the reference data was never loaded.
	 */
	assignDefaultRole(userId: string): Promise<void>;
	/**
	 * A named platform role, audited as the given system operation (the SuperAdmin bootstrap CLI), with
	 * `SUPER_ADMIN_BOOTSTRAPPED`-style extra audit rows written before the assignment row.
	 */
	assignPlatformRole(request: PlatformRoleAssignmentRequest): Promise<PlatformRoleAssignmentOutcome>;
	/** The live platform role's id, or `null` when the role catalog was never loaded (checked before anything is created). */
	findPlatformRoleId(roleName: string): Promise<string | null>;
}

export interface PlatformRoleAssignmentRequest {
	readonly userId: string;
	readonly roleName: string;
	/** `UserRole.assignedBy` and the audit actor: the allowlisted system operation that runs the provisioning. */
	readonly operation: SystemOperationName;
	/** Audit `detail` JSON (who ran the command). Never secrets. */
	readonly detail: string;
	/** Audit actions written before `ROLE_ASSIGNED_AT_PROVISIONING`, with the same actor, target and detail. */
	readonly precedingAuditActions: readonly "SUPER_ADMIN_BOOTSTRAPPED"[];
}

/** `role_missing` when the platform role catalog does not contain `roleName` (nothing was written). */
export type PlatformRoleAssignmentOutcome = { readonly kind: "assigned"; readonly roleId: string } | { readonly kind: "role_missing" };

/**
 * The same default-role assignment for an account that already exists, in its OWN RBAC transaction
 * (under the RBAC lock, revoking the account's sessions and invalidating its cached authorization after
 * commit). Idempotent: an account that already holds the role is left untouched.
 */
export interface AccountDefaultRolePort {
	ensureDefaultRole(userId: string): Promise<void>;
}
