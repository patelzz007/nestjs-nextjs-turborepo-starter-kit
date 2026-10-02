import { canSelectAllLocations } from "@/lib/org/location-access";
import type { OrganizationLocationResponse } from "@workspace/shared";

import type { TenantContextState } from "./state";

export function selectSelectedLocationId(state: TenantContextState): string | null {
	return state.selectedLocationId;
}

/**
 * The store filter actually in effect, from the member's choice plus the
 * locations they may operate on (`undefined` = not loaded yet). `null` = all
 * stores. Pure, and shared with the server (`loadServerLocationScope`), so a
 * server page prefetches with exactly the filter the client's first render
 * asks for.
 *
 * - Locations not loaded: the choice as made — provisional; the API
 *   re-validates it, and it is re-derived once the locations arrive.
 * - A choice the member can still access wins.
 * - Otherwise "all stores" when the member may see org-wide rollups, else
 *   their first (for a single-store member: only) store.
 */
export function resolveEffectiveLocationId(selectedLocationId: string | null, accessibleLocations: readonly OrganizationLocationResponse[] | undefined): string | null {
	if (accessibleLocations === undefined) {
		return selectedLocationId;
	}
	if (selectedLocationId !== null && accessibleLocations.some((location) => location.id === selectedLocationId)) {
		return selectedLocationId;
	}
	if (canSelectAllLocations(accessibleLocations)) {
		return null;
	}
	return accessibleLocations.at(0)?.id ?? null;
}

/** The accessible location record for the effective filter (`undefined` for all stores or before the locations load). */
export function resolveActiveLocation(
	effectiveLocationId: string | null,
	accessibleLocations: readonly OrganizationLocationResponse[] | undefined,
): OrganizationLocationResponse | undefined {
	if (effectiveLocationId === null || accessibleLocations === undefined) {
		return undefined;
	}
	return accessibleLocations.find((location) => location.id === effectiveLocationId);
}

/** API query input form of a filter: the API reads an absent `locationId` as "all stores". */
export function toLocationQueryInput(locationId: string | null): string | undefined {
	return locationId ?? undefined;
}
