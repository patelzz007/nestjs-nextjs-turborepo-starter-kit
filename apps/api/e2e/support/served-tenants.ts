import type { ServedTenantPolicy } from "../../src/platform/application/tenancy/served-tenant.port";

/** A multi-tenant deployment's policy: every tenant is served. */
export const SERVES_EVERY_TENANT: ServedTenantPolicy = { servesTenant: (): boolean => true };

/** A single-tenant deployment's policy: only `tenantId` is served. */
export function servesOnly(tenantId: string): ServedTenantPolicy {
	return { servesTenant: (candidate: string): boolean => candidate === tenantId };
}
