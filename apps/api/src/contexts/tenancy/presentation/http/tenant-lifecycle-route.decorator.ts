import { SetMetadata } from "@nestjs/common";

import type { TenantLifecycleRouteKind } from "../../domain/policies/tenant-lifecycle.policy";

/** Metadata key for a route C1 exempts from the ordinary-tenant lifecycle check; its value is the route's kind. */
export const TENANT_LIFECYCLE_ROUTE_KEY = "tenantLifecycleRoute";

/**
 * Marks a tenant route that may run while the tenant is provisioning, suspended,
 * or pending deletion. Membership must still be active, except on the one `"leave"`
 * route (leave-tenant), which a suspended or pending member may call too.
 */
export const TenantLifecycleRoute = (kind: Exclude<TenantLifecycleRouteKind, "ordinary"> = "lifecycle"): ReturnType<typeof SetMetadata> =>
	SetMetadata(TENANT_LIFECYCLE_ROUTE_KEY, kind);
