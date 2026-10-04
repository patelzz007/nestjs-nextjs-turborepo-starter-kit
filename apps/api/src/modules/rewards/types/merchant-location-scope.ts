/**
 * The stores a merchant request may see, resolved server-side from the
 * caller's membership (or the API key's store) — never from raw client input.
 *
 * - `ALL_LOCATIONS`: every store of the organization (an `ALL_LOCATIONS`
 *   member, or an organization-wide API key, that asked for no single store).
 * - `SELECTED_LOCATIONS`: exactly these stores. An empty list is valid and
 *   matches nothing (a store-limited member whose stores were all removed).
 */
export type MerchantLocationScope = { readonly kind: "ALL_LOCATIONS" } | { readonly kind: "SELECTED_LOCATIONS"; readonly locationIds: readonly string[] };

export const ALL_LOCATIONS_SCOPE: MerchantLocationScope = { kind: "ALL_LOCATIONS" };

export function selectedLocationsScope(locationIds: readonly string[]): MerchantLocationScope {
	return { kind: "SELECTED_LOCATIONS", locationIds: [...new Set(locationIds)] };
}
