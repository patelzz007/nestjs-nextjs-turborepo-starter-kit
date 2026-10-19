import { MERCHANT_CAPABILITY } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantAccessGrant, MerchantAccessPort } from "../../../../platform/application/ports/authorization.port";
import { ALL_ANALYTICS_LOCATIONS, selectedAnalyticsLocations, type AnalyticsLocationScope } from "../../domain/value-objects/analytics-scope.value-object";

/** What a merchant analytics request asks for: the organization (resolved from the route) and, optionally, one store. */
export interface MerchantAnalyticsTarget {
	readonly organizationId: string;
	readonly locationId?: string | undefined;
}

/** The grant's store scope as analytics filters it: never "no filter" for a store-limited caller. */
export function toAnalyticsLocationScope(grant: MerchantAccessGrant): AnalyticsLocationScope {
	return grant.locationScope === "ALL_LOCATIONS" ? ALL_ANALYTICS_LOCATIONS : selectedAnalyticsLocations(grant.locationIds);
}

/**
 * `merchant:view_analytics` for the caller, then the stores it may see (a store-limited member or a
 * store-scoped key sees only its own stores; asking for another store is refused by the port).
 * Throws before any analytics row is read.
 */
export async function authorizeMerchantAnalytics(access: MerchantAccessPort, actor: ActorContext, target: MerchantAnalyticsTarget): Promise<AnalyticsLocationScope> {
	const grant = await access.assertCapability(actor, {
		organizationId: target.organizationId,
		capability: MERCHANT_CAPABILITY.viewAnalytics,
		locationId: target.locationId ?? null,
	});
	return toAnalyticsLocationScope(grant);
}
