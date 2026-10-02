import type { FeatureEffect } from "@workspace/client/lib/state/feature-store";

import type { TenantContextAction } from "./actions";
import type { TenantContextState } from "./state";

/** Writes the `organizationLocationId` cookie — the browser implementation lives in `lib/org/location.ts`. */
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
	return (action: TenantContextAction): void => {
		switch (action.type) {
			case "[ Tenant Context ] Initialized":
				return;
			case "[ Tenant Context ] Location Selected":
				cookie.write(action.locationId);
				return;
			case "[ Tenant Context ] All Locations Selected":
				cookie.clear();
				return;
			default:
				assertNever(action);
		}
	};
}

/** Exhaustiveness check: a new action must decide whether it touches the cookie. */
function assertNever(action: never): never {
	throw new Error(`Unhandled tenant context action: ${JSON.stringify(action)}`);
}
