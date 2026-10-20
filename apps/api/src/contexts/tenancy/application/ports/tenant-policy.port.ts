import type { LocationScopeType, MembershipRole } from "@workspace/shared";

/** The member a tenant Cedar decision is made for. */
export interface TenantPolicyPrincipal {
	readonly userId: string;
	readonly role: MembershipRole;
	readonly locationScope: LocationScopeType;
	readonly locationIds: readonly string[];
}

export interface TenantPolicyDecision {
	readonly allowed: boolean;
	readonly policyVersion: number;
}

/** Tenant Cedar policies (owned by authorization), as tenants consumes them. */
export interface TenantPolicyPort {
	/** The tenant's effective policy version (stamped on audit rows). */
	activePolicyVersion(tenantId: string): Promise<number>;
	evaluate(tenantId: string, principal: TenantPolicyPrincipal, action: string): Promise<TenantPolicyDecision>;
}

/** Tenant policy work bound to the caller's unit of work (a new tenant's policies are not committed yet). */
export interface TenantPolicyProvisioningPort {
	/** Publishes the default tenant policy for a new tenant (idempotent). */
	seedDefaultPolicies(tenantId: string, actorUserId: string): Promise<void>;
	/** The effective policy version read inside the transaction. */
	activePolicyVersion(tenantId: string): Promise<number>;
}
