import "server-only";

import { resolveEffectiveLocationId } from "@/features/tenant-context/selectors";
import { loadTenantContext, readLocationCookie } from "@/lib/merchant-server-api";
import { resolveMemberLocationAccess } from "@/contexts/tenancy/lib/tenant/location-access";
import type { Envelope, TenantContextResponse } from "@workspace/shared";
import { cache } from "react";

/** What the server knows about the member's store filter for one tenant request. */
export interface ServerLocationScope {
	/**
	 * The member's choice from this tenant's cookie, kept only when it
	 * names a store the member may operate on (`null` otherwise) — seeds the
	 * client tenant-context store.
	 */
	readonly selectedLocationId: string | null;
	/**
	 * The filter server pages prefetch with (`null` = all stores). Derived with
	 * the same pure rule the client's first render uses, from the same inputs
	 * (the cookie seed + the tenant context the layout hands down), so
	 * prefetched data lands under the key the client asks for.
	 */
	readonly effectiveLocationId: string | null;
	/** Passed to the client to seed `api.tenants.context` (`undefined` when it could not be loaded). */
	readonly tenantContext: Envelope<TenantContextResponse> | undefined;
}

/**
 * Resolves the store filter for `tenantSlug` on the server, memoized per request.
 * The cookie is client input: a store outside the member's accessible
 * locations is dropped here, and without a tenant context (not a
 * member) no cookie value is used at all. UX state only — the API must still
 * authorize every request against the membership's location scope.
 */
export const loadServerLocationScope = cache(async (tenantSlug: string): Promise<ServerLocationScope> => {
	const [cookieLocationId, tenantContext] = await Promise.all([readLocationCookie(tenantSlug), loadTenantContext(tenantSlug)]);
	if (tenantContext === undefined) {
		return { selectedLocationId: null, effectiveLocationId: null, tenantContext };
	}

	const access = resolveMemberLocationAccess(tenantContext.data);
	const selectedLocationId = access.locations.some((location) => location.id === cookieLocationId) ? cookieLocationId : null;

	return {
		selectedLocationId,
		effectiveLocationId: resolveEffectiveLocationId(selectedLocationId, access),
		tenantContext,
	};
});
