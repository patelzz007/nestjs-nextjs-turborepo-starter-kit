import type { LocationScopeType } from "@workspace/shared";

import { RewardLocationForbiddenError, RewardLocationInvalidError } from "../errors/reward.errors";
import { RewardLocationScope } from "../value-objects/reward-location-scope.value-object";

/** What the tenant's stores look like for one request. */
export interface TenantStoreFacts {
	/** Live, active stores of the tenant. */
	readonly activeLocationCount: number;
	/** Which of the requested store ids are live, active stores of the tenant. */
	readonly activeRequestedLocationIds: readonly string[];
}

/** The stores the caller asked the reward to be offered at. */
export interface RequestedRewardLocations {
	readonly scopeType: LocationScopeType;
	readonly locationIds: readonly string[];
}

function requireAllActive(requested: readonly string[], facts: TenantStoreFacts): RewardLocationScope {
	const active = new Set(facts.activeRequestedLocationIds);
	if (requested.some((locationId) => !active.has(locationId))) {
		throw new RewardLocationInvalidError();
	}
	return RewardLocationScope.selected(requested);
}

/**
 * Pure store-scope rule for a new reward.
 *
 * - A store-limited caller (`managerLocationIds` set) may only name its own stores: an
 *   tenant-wide reward, or one that also names another store, is forbidden (403).
 * - A tenant with at most one store makes every reward tenant-wide.
 * - Every named store must be a live, active store of the tenant (400).
 */
export function decideRewardLocationScope(managerLocationIds: readonly string[] | null, facts: TenantStoreFacts, requested: RequestedRewardLocations): RewardLocationScope {
	const unique = [...new Set(requested.locationIds)];
	if (managerLocationIds !== null) {
		if (requested.scopeType === "ALL_LOCATIONS" || unique.some((locationId) => !managerLocationIds.includes(locationId))) {
			throw new RewardLocationForbiddenError();
		}
		return requireAllActive(unique, facts);
	}
	if (facts.activeLocationCount <= 1 || requested.scopeType === "ALL_LOCATIONS") {
		return RewardLocationScope.allLocations();
	}
	return requireAllActive(unique, facts);
}
