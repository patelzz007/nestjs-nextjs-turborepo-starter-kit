import type { StoreFeatureFlagKey, StoreFlagTarget } from "@workspace/shared";

/**
 * Whether a store flag is on at one store (enhancement 5.11), for the contexts that act at a store (a till's
 * redemption): the branch's own setting, else its merchant's, else the deployment's, else the flag's default.
 * Exported through `public-api.ts`; read under `feature_flags.evaluate`, which sees nothing but the flags.
 */
export interface StoreFeatureFlags {
	isOnAtStore(key: StoreFeatureFlagKey, store: StoreFlagTarget, subjectId: string | null): Promise<boolean>;
}

export const STORE_FEATURE_FLAGS = Symbol("STORE_FEATURE_FLAGS");
