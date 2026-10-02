import "server-only";

import { resolveEffectiveLocationId } from "@/features/tenant-context/selectors";
import { loadOrganizationContext, readOrganizationLocationCookie } from "@/lib/merchant-server-api";
import { resolveAccessibleLocations } from "@/lib/org/location-access";
import type { OrganizationContextResponse } from "@workspace/shared";
import { cache } from "react";

/** What the server knows about the member's store filter for one organization request. */
export interface ServerLocationScope {
	/** The member's choice as the cookie holds it — seeds the client tenant-context store. */
	readonly selectedLocationId: string | null;
	/**
	 * The filter server pages prefetch with (`null` = all stores). Derived with
	 * the same pure rule the client's first render uses, from the same inputs
	 * (the cookie seed + the organization context the layout hands down), so
	 * prefetched data lands under the key the client asks for.
	 */
	readonly effectiveLocationId: string | null;
	/** Passed to the client to seed `api.organizations.context` (`undefined` when it could not be loaded). */
	readonly organizationContext: OrganizationContextResponse | undefined;
}

/**
 * Resolves the store filter for `orgSlug` on the server, memoized per request.
 * Never an authorization decision: the API re-validates `locationId` against
 * the membership on every call.
 */
export const loadServerLocationScope = cache(async (orgSlug: string): Promise<ServerLocationScope> => {
	const [selectedLocationId, organizationContext] = await Promise.all([readOrganizationLocationCookie(), loadOrganizationContext(orgSlug)]);
	const accessibleLocations = organizationContext === undefined ? undefined : resolveAccessibleLocations(organizationContext);

	return {
		selectedLocationId,
		effectiveLocationId: resolveEffectiveLocationId(selectedLocationId, accessibleLocations),
		organizationContext,
	};
});
