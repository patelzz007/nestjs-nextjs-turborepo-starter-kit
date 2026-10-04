import "server-only";

import { resolveEffectiveLocationId } from "@/features/tenant-context/selectors";
import { loadOrganizationContext, readOrganizationLocationCookie } from "@/lib/merchant-server-api";
import { resolveMemberLocationAccess } from "@/lib/org/location-access";
import type { Envelope, OrganizationContextResponse } from "@workspace/shared";
import { cache } from "react";

/** What the server knows about the member's store filter for one organization request. */
export interface ServerLocationScope {
	/**
	 * The member's choice from this organization's cookie, kept only when it
	 * names a store the member may operate on (`null` otherwise) — seeds the
	 * client tenant-context store.
	 */
	readonly selectedLocationId: string | null;
	/**
	 * The filter server pages prefetch with (`null` = all stores). Derived with
	 * the same pure rule the client's first render uses, from the same inputs
	 * (the cookie seed + the organization context the layout hands down), so
	 * prefetched data lands under the key the client asks for.
	 */
	readonly effectiveLocationId: string | null;
	/** Passed to the client to seed `api.organizations.context` (`undefined` when it could not be loaded). */
	readonly organizationContext: Envelope<OrganizationContextResponse> | undefined;
}

/**
 * Resolves the store filter for `orgSlug` on the server, memoized per request.
 * The cookie is client input: a store outside the member's accessible
 * locations is dropped here, and without an organization context (not a
 * member) no cookie value is used at all. UX state only — the API must still
 * authorize every request against the membership's location scope.
 */
export const loadServerLocationScope = cache(async (orgSlug: string): Promise<ServerLocationScope> => {
	const [cookieLocationId, organizationContext] = await Promise.all([readOrganizationLocationCookie(orgSlug), loadOrganizationContext(orgSlug)]);
	if (organizationContext === undefined) {
		return { selectedLocationId: null, effectiveLocationId: null, organizationContext };
	}

	const access = resolveMemberLocationAccess(organizationContext.data);
	const selectedLocationId = access.locations.some((location) => location.id === cookieLocationId) ? cookieLocationId : null;

	return {
		selectedLocationId,
		effectiveLocationId: resolveEffectiveLocationId(selectedLocationId, access),
		organizationContext,
	};
});
