import type { OrganizationContextResponse, OrganizationLocationResponse } from "@workspace/shared";

/** All organization locations including pending review (for settings/management views). */
export function resolveAllOrganizationLocations(context: OrganizationContextResponse): readonly OrganizationLocationResponse[] {
	return context.locations;
}

/** Active locations only — eligible for team assignment, rewards scope, and POS operations. */
export function resolveActiveOrganizationLocations(context: OrganizationContextResponse): readonly OrganizationLocationResponse[] {
	return context.locations.filter((location) => location.status === "ACTIVE");
}

/** Active locations the signed-in member may operate on within an organization. */
export function resolveAccessibleLocations(context: OrganizationContextResponse): readonly OrganizationLocationResponse[] {
	const activeLocations = resolveActiveOrganizationLocations(context);

	if (context.membership.locationScopeType === "ALL_LOCATIONS") {
		return activeLocations;
	}

	return activeLocations.filter((location) => context.membership.locationIds.includes(location.id));
}

/**
 * What the member may do with stores in one organization, from their
 * membership's location scope. Derived (never stored) from the organization
 * context — UX state only: the API authorizes every request on its own.
 */
export interface MemberLocationAccess {
	/** Active stores the member may operate on. */
	readonly locations: readonly OrganizationLocationResponse[];
	/**
	 * Whether the membership covers the whole organization (`ALL_LOCATIONS`).
	 * Only such a member may ask for organization-wide data or create an
	 * organization-wide credential.
	 */
	readonly hasOrganizationWideAccess: boolean;
}

export function resolveMemberLocationAccess(context: OrganizationContextResponse): MemberLocationAccess {
	return {
		locations: resolveAccessibleLocations(context),
		hasOrganizationWideAccess: context.membership.locationScopeType === "ALL_LOCATIONS",
	};
}

/**
 * Whether "All locations" (org-wide rollups, sent as an absent `locationId`) is
 * offered: only to a member whose scope is the whole organization AND who has
 * more than one store to roll up. A store-limited (`SELECTED`) member always
 * works on one of their own stores, so the client never asks the API for data
 * beyond the member's scope.
 */
export function canSelectAllLocations(access: MemberLocationAccess): boolean {
	return access.hasOrganizationWideAccess && access.locations.length > 1;
}
