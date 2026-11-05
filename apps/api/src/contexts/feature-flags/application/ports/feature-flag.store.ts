import type { EpochMs, FeatureFlagKey, FeatureFlagMode, FeatureFlagStoreOption, StoreFeatureFlagKey } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** A flag's stored setting; `updatedByName` only on the console's list. */
export interface FeatureFlagRecord {
	readonly key: FeatureFlagKey;
	readonly mode: FeatureFlagMode;
	readonly percentage: number | null;
	readonly reason: string;
	readonly updatedAt: EpochMs;
	readonly updatedByName: string | null;
}

export interface FeatureFlagChange {
	readonly mode: FeatureFlagMode;
	readonly percentage: number | null;
	readonly reason: string;
	readonly at: EpochMs;
}

/** A store's own setting of a store flag (enhancement 5.11), with the store's names for the console. */
export interface StoreOverrideRecord {
	readonly id: string;
	readonly key: StoreFeatureFlagKey;
	readonly tenantId: string;
	readonly tenantName: string;
	readonly locationId: string | null;
	readonly locationName: string | null;
	readonly enabled: boolean;
	readonly reason: string;
	readonly updatedAt: EpochMs;
	readonly updatedByName: string | null;
}

export interface StoreOverrideChange {
	readonly tenantId: string;
	readonly locationId: string | null;
	readonly enabled: boolean;
	readonly reason: string;
	readonly at: EpochMs;
}

/** The feature flags' settings (enhancements 5.6, 5.11), under `feature_flags.read` / `feature_flags.write`. */
export interface FeatureFlagStore {
	/** Every stored setting; with `names`, who last changed each. */
	settings(actor: ActorContext, names: boolean): Promise<readonly FeatureFlagRecord[]>;
	/** Writes one flag's setting (creating its row the first time) and answers it. */
	save(actor: ActorContext, key: FeatureFlagKey, change: FeatureFlagChange): Promise<FeatureFlagRecord>;
	/** A store flag's live per-store settings, merchants then branches by name. */
	storeOverrides(actor: ActorContext, key: StoreFeatureFlagKey): Promise<readonly StoreOverrideRecord[]>;
	/**
	 * Sets a store's own value of a flag: its earlier setting (if any) is soft-deleted and the new one written, in
	 * one transaction. `null` when the merchant does not exist or the branch is not one of its live branches.
	 */
	setStoreOverride(actor: ActorContext, key: StoreFeatureFlagKey, change: StoreOverrideChange): Promise<StoreOverrideRecord | null>;
	/** Live merchants whose name contains `search` (all when empty), by name, each with its live branches. */
	searchStores(actor: ActorContext, search: string, limit: number): Promise<readonly FeatureFlagStoreOption[]>;
	/** Soft-deletes one per-store setting (the store follows the deployment again); false when there is none. */
	removeStoreOverride(actor: ActorContext, key: StoreFeatureFlagKey, overrideId: string, at: EpochMs): Promise<boolean>;
}

export const FEATURE_FLAG_STORE = Symbol("FEATURE_FLAG_STORE");
export const FEATURE_FLAGS_SERVICE = Symbol("FEATURE_FLAGS_SERVICE");

/** The operations the routes declare and the store runs under: one name each, so they can't drift apart. */
export const FEATURE_FLAGS_READ_OPERATION: SystemOperationName = "feature_flags.read";
export const FEATURE_FLAGS_WRITE_OPERATION: SystemOperationName = "feature_flags.write";
