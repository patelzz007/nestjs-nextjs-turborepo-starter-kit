import type { TenantContextResponse, LocationResponse } from "@workspace/shared";

/** All tenant locations including pending review (for settings/management views). */
export function resolveAllLocations(context: TenantContextResponse): readonly LocationResponse[] {
	return context.locations;
}

/** Active locations only — eligible for team assignment, rewards scope, and POS operations. */
export function resolveActiveLocations(context: TenantContextResponse): readonly LocationResponse[] {
	return context.locations.filter((location) => location.status === "ACTIVE");
}

/** Active locations the signed-in member may operate on within a tenant. */
export function resolveAccessibleLocations(context: TenantContextResponse): readonly LocationResponse[] {
	const activeLocations = resolveActiveLocations(context);

	if (context.membership.locationScopeType === "ALL_LOCATIONS") {
		return activeLocations;
	}

	return activeLocations.filter((location) => context.membership.locationIds.includes(location.id));
}

/**
 * What the member may do with stores in one tenant, from their
 * membership's location scope. Derived (never stored) from the tenant
 * context — UX state only: the API authorizes every request on its own.
 */
export interface MemberLocationAccess {
	/** Active stores the member may operate on. */
	readonly locations: readonly LocationResponse[];
	/**
	 * Whether the membership covers the whole tenant (`ALL_LOCATIONS`).
	 * Only such a member may ask for tenant-wide data or create an
	 * tenant-wide credential.
	 */
	readonly hasTenantWideAccess: boolean;
}

export function resolveMemberLocationAccess(context: TenantContextResponse): MemberLocationAccess {
	return {
		locations: resolveAccessibleLocations(context),
		hasTenantWideAccess: context.membership.locationScopeType === "ALL_LOCATIONS",
	};
}

/**
 * Whether "All locations" (tenant-wide rollups, sent as an absent `locationId`) is
 * offered: only to a member whose scope is the whole tenant AND who has
 * more than one store to roll up. A store-limited (`SELECTED`) member always
 * works on one of their own stores, so the client never asks the API for data
 * beyond the member's scope.
 */
export function canSelectAllLocations(access: MemberLocationAccess): boolean {
	return access.hasTenantWideAccess && access.locations.length > 1;
}
