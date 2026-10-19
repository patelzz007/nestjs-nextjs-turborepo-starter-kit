import type { EpochMs } from "@workspace/shared";

import type { Location, LocationState } from "../aggregates/location.aggregate";

/** A stored location with the fields persistence assigns (code, timestamps). */
export interface PersistedLocation extends LocationState {
	readonly code: string;
	readonly createdAt: EpochMs;
	readonly updatedAt: EpochMs;
}

/** What closing a store removed from the organization's own tables. */
export interface StoreAccessRemoval {
	readonly storeId: string;
	readonly storeMembershipsRemoved: number;
	readonly memberScopesRemoved: number;
}

/** Persistence port of the {@link Location} aggregate (bound to one unit of work). */
export interface LocationRepository {
	nextId(): string;
	/** Serializes every location write of one organization until the unit of work ends (advisory lock). */
	lockOrganization(organizationId: string): Promise<void>;
	countPending(organizationId: string): Promise<number>;
	/** How many of `locationIds` are live ACTIVE stores of the organization. */
	countActiveAmong(organizationId: string, locationIds: readonly string[]): Promise<number>;
	/** Names of the live ACTIVE stores among `locationIds`, alphabetical. */
	activeNamesAmong(organizationId: string, locationIds: readonly string[]): Promise<readonly string[]>;
	findLive(organizationId: string, locationId: string): Promise<Location | null>;
	findLivePrimary(organizationId: string): Promise<Location | null>;
	/** Inserts the location (allocating its code) and its store mirror. */
	add(location: Location): Promise<PersistedLocation>;
	/** Compare-and-set on the loaded status; mirrors the result onto the store. */
	save(location: Location): Promise<PersistedLocation>;
	/** For a closed location: soft-deletes its store memberships and removes member scope rows pointing at it. */
	removeStoreAccess(location: Location, closedByUserId: string, at: EpochMs): Promise<StoreAccessRemoval>;
}
