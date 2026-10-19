import type { AnalyticsInterval } from "@workspace/shared";

/** A half-open time range `[fromMs, toMs)` in epoch ms. */
export interface AnalyticsTimeRange {
	readonly fromMs: number;
	readonly toMs: number;
}

/** A range cut into buckets: `interval`-wide, at local midnight / Monday / the 1st in `timeZone`. */
export interface AnalyticsWindow extends AnalyticsTimeRange {
	/** IANA zone, validated by `IanaTimeZoneSchema` upstream; always a bind parameter. */
	readonly timeZone: string;
	readonly interval: AnalyticsInterval;
}

/**
 * The stores a merchant analytics request may see, resolved server-side from the caller's
 * membership (or the API key's store), never from raw client input.
 *
 * - `ALL_LOCATIONS`: every store of the organization.
 * - `SELECTED_LOCATIONS`: exactly these stores. An empty list is valid and matches nothing.
 */
export type AnalyticsLocationScope = { readonly kind: "ALL_LOCATIONS" } | { readonly kind: "SELECTED_LOCATIONS"; readonly locationIds: readonly string[] };

export const ALL_ANALYTICS_LOCATIONS: AnalyticsLocationScope = { kind: "ALL_LOCATIONS" };

/** Exactly these stores (de-duplicated). */
export function selectedAnalyticsLocations(locationIds: readonly string[]): AnalyticsLocationScope {
	return { kind: "SELECTED_LOCATIONS", locationIds: [...new Set(locationIds)] };
}

/**
 * WHOSE activity an analytics query covers — resolved server-side from the
 * caller (never from raw client input):
 *
 * - `platform`: every merchant (the admin view).
 * - `organization`: one merchant, limited to `locationScope` (a store-limited
 *   member or store-scoped API key never sees another store's bills,
 *   redemptions, or claims of rewards not offered at its stores).
 * - `customer`: one customer's own activity.
 */
export type AnalyticsScope =
	| { readonly kind: "platform" }
	| { readonly kind: "organization"; readonly organizationId: string; readonly locationScope: AnalyticsLocationScope }
	| { readonly kind: "customer"; readonly userId: string };

/** One merchant's analytics scope (the store breakdown only exists for a merchant). */
export type OrganizationAnalyticsScope = Extract<AnalyticsScope, { readonly kind: "organization" }>;
