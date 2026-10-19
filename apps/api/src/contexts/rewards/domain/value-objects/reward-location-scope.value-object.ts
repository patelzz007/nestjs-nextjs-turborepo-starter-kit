import type { OrganizationLocationScopeType } from "@workspace/shared";

/**
 * Where a reward can be claimed and redeemed: every store of the organization, or exactly the
 * listed stores (unique ids, in the order they were chosen).
 */
export class RewardLocationScope {
	private constructor(
		public readonly type: OrganizationLocationScopeType,
		public readonly locationIds: readonly string[],
	) {}

	public static allLocations(): RewardLocationScope {
		return new RewardLocationScope("ALL_LOCATIONS", []);
	}

	public static selected(locationIds: readonly string[]): RewardLocationScope {
		return new RewardLocationScope("SELECTED", [...new Set(locationIds)]);
	}

	/** Stored columns: a `SELECTED` reward lists its stores; an `ALL_LOCATIONS` reward has none. */
	public static fromStorage(type: OrganizationLocationScopeType, locationIds: readonly string[]): RewardLocationScope {
		return type === "ALL_LOCATIONS" ? RewardLocationScope.allLocations() : RewardLocationScope.selected(locationIds);
	}

	/**
	 * Whether a caller limited to `managerLocationIds` (null = every store) may manage this reward:
	 * an organization-wide reward, or one that names another store, would reach stores it may not manage.
	 */
	public isManageableBy(managerLocationIds: readonly string[] | null): boolean {
		if (managerLocationIds === null) {
			return true;
		}
		if (this.type === "ALL_LOCATIONS" || this.locationIds.length === 0) {
			return false;
		}
		return this.locationIds.every((locationId) => managerLocationIds.includes(locationId));
	}

	public equals(other: RewardLocationScope): boolean {
		return (
			this.type === other.type &&
			this.locationIds.length === other.locationIds.length &&
			this.locationIds.every((locationId, position) => other.locationIds.at(position) === locationId)
		);
	}
}
