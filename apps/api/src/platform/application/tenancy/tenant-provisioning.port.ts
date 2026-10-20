/**
 * Whether this deployment may create new tenants. A multi-tenant deployment does: a platform admin
 * invites a merchant and the invite provisions its tenant. A single-tenant deployment serves the one
 * seeded tenant and nothing else, so it refuses to create a second one. The deployment decides, not
 * the caller; the binding lives in the tenancy infrastructure beside {@link TenantSource}.
 */
export interface TenantProvisioningGate {
	isProvisioningAllowed(): boolean;
}

/** Nest token for the deployment's {@link TenantProvisioningGate}. */
export const TENANT_PROVISIONING_GATE = Symbol("TENANT_PROVISIONING_GATE");
