import type { LocationScopeType } from "@workspace/shared";

import { InvalidLocationsError, ScopeEscalationError, StoreOutOfScopeError } from "../errors/tenants.errors";

/** One stored scope row of a membership or invitation (`MembershipLocationScope`). */
export interface LocationScopeRow {
	readonly scopeType: LocationScopeType;
	readonly locationId: string | null;
}

/**
 * Which stores a member (or an invitation) covers: every store, or exactly the
 * listed ones. Immutable; validated on creation.
 */
export class LocationScope {
	private constructor(
		public readonly type: LocationScopeType,
		public readonly locationIds: readonly string[],
	) {}

	public static allLocations(): LocationScope {
		return new LocationScope("ALL_LOCATIONS", []);
	}

	/** Exactly these stores, in the given order. */
	public static selected(locationIds: readonly string[]): LocationScope {
		return new LocationScope("SELECTED", [...locationIds]);
	}

	/** The scope a request asks for: ALL_LOCATIONS ignores ids; SELECTED keeps exactly the listed stores. */
	public static of(type: LocationScopeType, locationIds: readonly string[]): LocationScope {
		return type === "ALL_LOCATIONS" ? LocationScope.allLocations() : LocationScope.selected(locationIds);
	}

	/**
	 * Fail closed: only explicit ALL_LOCATIONS rows (and no SELECTED row) grant
	 * every store. No rows, or any SELECTED row, means exactly the listed stores,
	 * so a membership without scope rows reaches no store at all.
	 */
	public static fromRows(rows: readonly LocationScopeRow[]): LocationScope {
		const locationIds = rows.flatMap((row): string[] => (row.scopeType === "SELECTED" && row.locationId !== null ? [row.locationId] : []));
		const hasSelectedRow = rows.some((row) => row.scopeType === "SELECTED");
		const hasAllLocationsRow = rows.some((row) => row.scopeType === "ALL_LOCATIONS");
		return hasAllLocationsRow && !hasSelectedRow ? LocationScope.allLocations() : LocationScope.selected(locationIds);
	}

	public get coversAllLocations(): boolean {
		return this.type === "ALL_LOCATIONS";
	}

	public covers(locationId: string): boolean {
		return this.coversAllLocations || this.locationIds.includes(locationId);
	}

	/** Throws {@link StoreOutOfScopeError} unless this scope covers the store. */
	public assertCovers(locationId: string): void {
		if (!this.covers(locationId)) {
			throw new StoreOutOfScopeError();
		}
	}

	/**
	 * A manager scoped to SELECTED stores may only grant SELECTED access to
	 * stores they hold themselves: never ALL_LOCATIONS, never a store outside
	 * their own scope.
	 */
	public assertCanGrant(granted: LocationScope): void {
		if (this.coversAllLocations) {
			return;
		}
		if (granted.coversAllLocations || granted.locationIds.some((locationId) => !this.locationIds.includes(locationId))) {
			throw new ScopeEscalationError();
		}
	}

	/** A SELECTED scope must name only live, approved stores: `activeCount` is how many of its stores are ACTIVE. */
	public assertAllActive(activeCount: number): void {
		if (!this.coversAllLocations && activeCount !== this.locationIds.length) {
			throw new InvalidLocationsError();
		}
	}

	/** The rows this scope is stored as (one ALL_LOCATIONS row, or one SELECTED row per store). */
	public toRows(): readonly LocationScopeRow[] {
		if (this.coversAllLocations) {
			return [{ scopeType: "ALL_LOCATIONS", locationId: null }];
		}
		return this.locationIds.map((locationId): LocationScopeRow => ({ scopeType: "SELECTED", locationId }));
	}

	/** The same scope without one store (SELECTED only). */
	public without(locationId: string): LocationScope {
		return LocationScope.selected(this.locationIds.filter((id) => id !== locationId));
	}

	public equals(other: LocationScope): boolean {
		return this.type === other.type && this.locationIds.length === other.locationIds.length && this.locationIds.every((id) => other.locationIds.includes(id));
	}
}
