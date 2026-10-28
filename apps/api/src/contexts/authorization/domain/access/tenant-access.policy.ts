// ============================================
// domain/access/tenant-access.policy.ts — the fixed rules of tenant access administration (ADR 067)
// ============================================
// Pure DOMAIN POLICIES (no I/O): each rule is one function that throws a domain
// error, so the application service reads as a list of guardrails and every
// rule is unit-tested on its own (Single Responsibility).

import { isTenantPermission, type MembershipRole, type PermissionPair } from "@workspace/shared";

import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";
import type { StoreScope } from "./store-scope";

const OWNER: MembershipRole = "OWNER";

/** The tenant's Owner role can never be edited or deleted: it always holds every tenant permission. */
export class OwnerRoleProtectedError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_OWNER_PROTECTED";

	public constructor() {
		super("The Owner role cannot be edited or deleted");
	}
}

/** A change would leave the tenant without an Owner, or a non-Owner tried to make someone an Owner. */
export class OwnerRequiredError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_OWNER_REQUIRED";

	public constructor(message: string) {
		super(message);
	}
}

/** A grant or share wider than the granter's own role gives them (grants are not delegable). */
export class DelegationRefusedError extends DomainError {
	public readonly code: DomainErrorCode = "TENANT_SCOPE_ESCALATION";

	public constructor(message: string) {
		super(message);
	}
}

/** Members still hold the role: reassign them first (`holdersVersion` is what reassign must quote). */
export class RoleInUseError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor(holderCount: number, holdersVersion: string) {
		super(`${String(holderCount)} member(s) still hold this role — choose a new role for each of them first`, { holderCount, holdersVersion });
	}
}

/** The holder list changed between reading it and reassigning (someone joined or left the role). */
export class StaleHoldersError extends DomainError {
	public readonly code: DomainErrorCode = "CONFLICT";

	public constructor() {
		super("The members holding this role changed — reload them and try again");
	}
}

/** A role's template, as far as the guardrails care. */
export interface RoleTemplateView {
	readonly templateKey: MembershipRole | null;
}

/** Owner guardrail 1: the Owner role is never edited or deleted. */
export function assertRoleEditable(role: RoleTemplateView): void {
	if (role.templateKey === OWNER) {
		throw new OwnerRoleProtectedError();
	}
}

/** A tenant role only ever holds tenant permissions — a platform permission never leaks into a tenant. */
export function assertTenantPermissions(permissions: readonly PermissionPair[]): void {
	const foreign = permissions.find((permission) => !isTenantPermission(permission));
	if (foreign !== undefined) {
		throw new DelegationRefusedError(`${foreign.resource.toLowerCase()}.${foreign.action.toLowerCase()} is not a tenant permission`);
	}
}

/**
 * Owner guardrails 2 and 3 for a member's role change: only an Owner makes someone an Owner, and the
 * last Owner can never be moved off the Owner role.
 */
export function assertOwnerChange(change: {
	readonly actorIsOwner: boolean;
	readonly from: RoleTemplateView;
	readonly to: RoleTemplateView;
	readonly ownersLeft: number;
}): void {
	if (change.to.templateKey === OWNER && change.from.templateKey !== OWNER && !change.actorIsOwner) {
		throw new OwnerRequiredError("Only an Owner can make someone an Owner");
	}
	if (change.from.templateKey === OWNER && change.to.templateKey !== OWNER && change.ownersLeft <= 1) {
		throw new OwnerRequiredError("A tenant always keeps at least one Owner");
	}
}

/**
 * Grants and shares are NOT delegable: the granter may give only what THEIR ROLE gives them (never a
 * permission they hold through a grant or share), and only within their own stores.
 */
export function assertDelegable(
	granter: { readonly rolePermissions: readonly PermissionPair[]; readonly stores: StoreScope },
	permission: PermissionPair,
	scope: StoreScope,
): void {
	if (!granter.rolePermissions.some((held) => held.action === permission.action && held.resource === permission.resource)) {
		throw new DelegationRefusedError("You can only give a permission your own role gives you");
	}
	if (!granter.stores.includes(scope)) {
		throw new DelegationRefusedError("You can only give a permission within your own stores");
	}
}
