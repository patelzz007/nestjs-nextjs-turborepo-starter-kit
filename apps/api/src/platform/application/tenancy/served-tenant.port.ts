/**
 * Which tenants this deployment serves. A multi-tenant deployment serves every tenant. A
 * single-tenant deployment serves only `DEFAULT_TENANT_ID`: a row of another tenant that is still in
 * the database (an old import, a mode switch) is not reachable through it — not by a store or
 * location id, not by an API key. The binding lives in the tenancy infrastructure beside
 * {@link TenantSource}, so nothing else branches on the mode.
 */
export interface ServedTenantPolicy {
	servesTenant(tenantId: string): boolean;
}

/** Nest token for the deployment's {@link ServedTenantPolicy}. */
export const SERVED_TENANT_POLICY = Symbol("SERVED_TENANT_POLICY");
