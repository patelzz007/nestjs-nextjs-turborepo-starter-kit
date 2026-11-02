/** Drops a tenant's cached route lookups everywhere, after its lifecycle changed (ADR 072). */
export interface TenantRouteCachePort {
	invalidateTenant(tenantId: string): Promise<void>;
}

export const TENANT_ROUTE_CACHE = Symbol("TENANT_ROUTE_CACHE");
