import { SetMetadata } from "@nestjs/common";

/** Metadata key for a route C1 exempts from the ordinary-tenant lifecycle check. */
export const TENANT_LIFECYCLE_ROUTE_KEY = "tenantLifecycleRoute";

/**
 * Marks a tenant route that may run while the tenant is provisioning, suspended,
 * or pending deletion. Membership must still be active, except on leave-tenant.
 */
export const TenantLifecycleRoute = (): ReturnType<typeof SetMetadata> => SetMetadata(TENANT_LIFECYCLE_ROUTE_KEY, true);
