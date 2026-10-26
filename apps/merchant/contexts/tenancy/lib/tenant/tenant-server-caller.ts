import "server-only";

import { createServerCaller } from "@workspace/client/lib/api/server-api";
import { cache } from "react";

import type { MerchantServerCaller } from "@/lib/merchant-server-api";
import { requestScopeHeaders } from "@/lib/session/request-scope-headers";
import { loadServerLocationScope } from "@/contexts/tenancy/lib/tenant/server-location-scope";

/**
 * The server caller of one tenant page: it names the tenant and the store in
 * effect on every call (`X-Tenant-Id`, `X-Location-Id`), exactly as the
 * browser does once the page is interactive, so the audit trail shows the same
 * scope for a server prefetch as for the client's own request. Memoized per
 * request (`React.cache`).
 *
 * Built from the tenant context the layout already loads: without one (not a
 * member) it names nothing, and the page guard denies anyway. The headers are
 * information for the audit trail only; the API takes the tenant from the
 * `/tenants/:tenantSlug` path.
 */
export const loadTenantServerCaller = cache(async (tenantSlug: string): Promise<MerchantServerCaller> => {
	const scope = await loadServerLocationScope(tenantSlug);
	return createServerCaller({
		clientType: "merchant",
		requestHeaders: requestScopeHeaders({ tenantId: scope.tenantContext?.data.tenant.id, locationId: scope.effectiveLocationId }),
	});
});
