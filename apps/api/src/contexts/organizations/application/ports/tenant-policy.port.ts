import type { OrganizationLocationScopeType, OrganizationMembershipRole } from "@workspace/shared";

/** The member a tenant Cedar decision is made for. */
export interface TenantPolicyPrincipal {
	readonly userId: string;
	readonly role: OrganizationMembershipRole;
	readonly locationScope: OrganizationLocationScopeType;
	readonly locationIds: readonly string[];
}

export interface TenantPolicyDecision {
	readonly allowed: boolean;
	readonly policyVersion: number;
}

/** Tenant Cedar policies (owned by authorization), as organizations consumes them. */
export interface TenantPolicyPort {
	/** The organization's effective policy version (stamped on audit rows). */
	activePolicyVersion(organizationId: string): Promise<number>;
	evaluate(organizationId: string, principal: TenantPolicyPrincipal, action: string): Promise<TenantPolicyDecision>;
}

/** Tenant policy work bound to the caller's unit of work (a new organization's policies are not committed yet). */
export interface TenantPolicyProvisioningPort {
	/** Publishes the default tenant policy for a new organization (idempotent). */
	seedDefaultPolicies(organizationId: string, actorUserId: string): Promise<void>;
	/** The effective policy version read inside the transaction. */
	activePolicyVersion(organizationId: string): Promise<number>;
}
