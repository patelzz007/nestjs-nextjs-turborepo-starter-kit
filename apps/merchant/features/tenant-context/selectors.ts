import { canSelectAllLocations, type MemberLocationAccess } from "@/lib/org/location-access";
import type { OrganizationLocationResponse } from "@workspace/shared";

import type { TenantContextState } from "./state";

export function selectSelectedLocationId(state: TenantContextState): string | null {
	return state.selectedLocationId;
}

export function selectRejectedLocationIds(state: TenantContextState): readonly string[] {
	return state.rejectedLocationIds;
}

/** The member's access without the stores the API refused during this mount. */
export function withoutRejectedLocations(access: MemberLocationAccess, rejectedLocationIds: readonly string[]): MemberLocationAccess {
	if (rejectedLocationIds.length === 0) {
		return access;
	}
	return { ...access, locations: access.locations.filter((location) => !rejectedLocationIds.includes(location.id)) };
}

/**
 * The store filter actually in effect, from the member's choice plus what the
 * member may access (`undefined` = not loaded yet). `null` = all stores. Pure,
 * and shared with the server (`loadServerLocationScope`), so a server page
 * prefetches with exactly the filter the client's first render asks for.
 *
 * - Access not loaded: the choice as made — provisional, re-derived once the
 *   organization context arrives (the org layout seeds it, so a member's first
 *   render already has it).
 * - A choice the member can still access wins.
 * - Otherwise "all stores" when the member may see org-wide rollups, else
 *   their first (for a single-store member: only) store.
 */
export function resolveEffectiveLocationId(selectedLocationId: string | null, access: MemberLocationAccess | undefined): string | null {
	if (access === undefined) {
		return selectedLocationId;
	}
	if (selectedLocationId !== null && access.locations.some((location) => location.id === selectedLocationId)) {
		return selectedLocationId;
	}
	if (canSelectAllLocations(access)) {
		return null;
	}
	return access.locations.at(0)?.id ?? null;
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
