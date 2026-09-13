import type { OrganizationContextResponse, OrganizationLocationResponse } from "@workspace/shared";

/** Locations the signed-in member may operate on within an organization. */
export function resolveAccessibleLocations(context: OrganizationContextResponse): readonly OrganizationLocationResponse[] {
	if (context.membership.locationScopeType === "ALL_LOCATIONS") {
		return context.locations;
	}

	return context.locations.filter((location) => context.membership.locationIds.includes(location.id));
}

/** Whether the member can view org-wide rollups across multiple stores. */
export function canSelectAllLocations(accessibleLocations: readonly OrganizationLocationResponse[]): boolean {
	return accessibleLocations.length > 1;
}

/** Picks the initial active location from cookie + membership scope. */
export function resolveInitialLocationId(accessibleLocations: readonly OrganizationLocationResponse[], storedLocationId: string | undefined): string | undefined {
	if (accessibleLocations.length === 0) {
		return undefined;
	}

	if (accessibleLocations.length === 1) {
		const onlyLocation = accessibleLocations[0];
		return onlyLocation !== undefined ? onlyLocation.id : undefined;
	}

	if (storedLocationId !== undefined && accessibleLocations.some((location) => location.id === storedLocationId)) {
		return storedLocationId;
	}

	return undefined;
}
