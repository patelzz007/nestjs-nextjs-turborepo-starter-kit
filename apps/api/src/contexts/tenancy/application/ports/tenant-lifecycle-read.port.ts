import type { TenantLifecycleResponse } from "@workspace/shared";

/** How many appeals the lifecycle view lists (newest first). */
export const TENANT_LIFECYCLE_APPEAL_LIMIT = 20;

/**
 * The lifecycle view (state, current suspension, appeals) and the member check the tenant-side
 * lifecycle routes run themselves: those routes serve suspended and pending-deletion tenants,
 * which the ordinary tenant directory refuses. Reads run as `tenant.lifecycle.read`.
 */
export interface TenantLifecycleReadPort {
	/** The live, not DELETED tenant the route key names when `userId` holds an ACTIVE membership of it; otherwise `null`. */
	findMemberTenantId(routeKey: string, userId: string): Promise<string | null>;
	findLifecycle(tenantId: string): Promise<TenantLifecycleResponse | null>;
}
