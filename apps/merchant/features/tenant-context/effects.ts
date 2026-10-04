import { assertNever } from "@workspace/shared";
import type { FeatureEffect, FeatureEffectContext } from "@workspace/client/lib/state/feature-store";

import type { TenantContextAction } from "./actions";
import type { TenantContextState } from "./state";

/** Writes the organization's store-choice cookie (`organizationLocationId.<orgSlug>`) — the browser implementation lives in `lib/org/location.ts`. */
export interface LocationCookieWriter {
	readonly write: (locationId: string) => void;
	readonly clear: () => void;
}

/**
 * Mirrors the member's choice to the cookie the server reads, so the next
 * server render (a navigation or a reload) prefetches the same store's data.
 * `Initialized` writes nothing: its value came FROM the cookie.
 *
 * No query invalidation here, on purpose: every location-filtered query has
 * `locationId` in its key, so a new filter is a new key (fetched on demand)
 * and the previous store's entries stay cached for an instant switch back.
 */
export function createLocationCookieEffect(cookie: LocationCookieWriter): FeatureEffect<TenantContextState, TenantContextAction> {
	return (action: TenantContextAction, context: FeatureEffectContext<TenantContextState, TenantContextAction>): void => {
		switch (action.type) {
			case "[ Tenant Context ] Initialized":
				return;
			case "[ Tenant Context ] Location Selected":
				cookie.write(action.locationId);
				return;
			case "[ Tenant Context ] All Locations Selected":
				cookie.clear();
				return;
			case "[ Tenant Context ] Location Rejected": {
				// Rewrite the cookie from the state after the rejection, so the next server render never prefetches the refused store.
				const { selectedLocationId } = context.getState();
				if (selectedLocationId === null) {
					cookie.clear();
				} else {
					cookie.write(selectedLocationId);
				}
				return;
			}
			default:
				assertNever(action, "tenant context action");
		}
	};
}

/**
 * After the API refused a store, the member's scope has changed since the
 * organization context loaded: re-read it (`refreshOrganizationContext`), so
 * the switcher and the selectors work from the current accessible stores.
 */
export function createScopeRefreshEffect(refreshOrganizationContext: () => void): FeatureEffect<TenantContextState, TenantContextAction> {
	return (action: TenantContextAction): void => {
		if (action.type === "[ Tenant Context ] Location Rejected") {
			refreshOrganizationContext();
		}
	};
}
