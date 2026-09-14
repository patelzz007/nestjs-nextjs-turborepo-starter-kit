import type { OrganizationLocationScopeType } from "@prisma/client";

export interface MembershipLocationScopeRow {
	readonly organizationId: string;
	readonly scopeType: OrganizationLocationScopeType;
	readonly locationId: string | null;
}

export function buildMembershipLocationScopeRows(
	organizationId: string,
	locationScopeType: OrganizationLocationScopeType,
	locationIds: readonly string[],
): readonly MembershipLocationScopeRow[] {
	if (locationScopeType === "ALL_LOCATIONS") {
		return [{ organizationId, scopeType: "ALL_LOCATIONS", locationId: null }];
	}

	return locationIds.map((locationId) => ({
		organizationId,
		scopeType: "SELECTED",
		locationId,
	}));
}
