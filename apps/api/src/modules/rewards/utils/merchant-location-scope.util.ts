import type { OrganizationLocationScopeType, Prisma } from "@prisma/client";

import type { MerchantLocationScope } from "../types/merchant-location-scope";

/** Prisma `in` filter on a `location_id` column for `scope`; `undefined` = no store filter (every store). */
export function locationIdInFilter(scope: MerchantLocationScope): { in: string[] } | undefined {
	return scope.kind === "ALL_LOCATIONS" ? undefined : { in: [...scope.locationIds] };
}

/** Whether a row attributed to `locationId` (`null` = no store) is visible within `scope`. Store-less rows are organization-wide. */
export function isLocationInScope(scope: MerchantLocationScope, locationId: string | null): boolean {
	if (scope.kind === "ALL_LOCATIONS") {
		return true;
	}
	return locationId !== null && scope.locationIds.includes(locationId);
}

/** Rewards available at a store of `scope`: organization-wide rewards plus those limited to one of its stores. */
export function rewardAvailabilityWhere(scope: MerchantLocationScope): Prisma.RewardWhereInput {
	if (scope.kind === "ALL_LOCATIONS") {
		return {};
	}
	return { OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { locationId: { in: [...scope.locationIds] } } } }] };
}

/**
 * Whether a reward with the given availability lies entirely inside `scope`
 * — i.e. a store-limited actor may manage it. Organization-wide rewards are
 * outside any store-limited scope.
 */
export function isRewardWithinScope(
	scope: MerchantLocationScope,
	reward: { readonly locationScopeType: OrganizationLocationScopeType; readonly locationIds: readonly string[] },
): boolean {
	if (scope.kind === "ALL_LOCATIONS") {
		return true;
	}
	if (reward.locationScopeType === "ALL_LOCATIONS" || reward.locationIds.length === 0) {
		return false;
	}
	return reward.locationIds.every((locationId) => scope.locationIds.includes(locationId));
}
