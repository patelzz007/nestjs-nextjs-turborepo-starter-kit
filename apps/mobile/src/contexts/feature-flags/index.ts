// ============================================
// contexts/feature-flags — the context's public surface
// ============================================
// Feature flags and dynamic configs (ADR 087): the provider the app shell mounts,
// the hooks screens read flags with, and the installation's device id the API
// client sends. Code outside this folder imports from here, never from a file
// inside it (docs/architecture/ddd-cqrs-migration-plan.md §14.5).

import { featureFlagKeysFor, type FeatureFlagKey } from "@workspace/shared";

export { SECURE_STORE_BUNDLE_STORAGE, type BundleStorage } from "./cached-bundle";
export { FlagDeviceId, loadFlagDeviceId, secureStoreFlagDeviceIdStorage, type FlagDeviceIdStorage } from "./flag-device-id";
export {
	FEATURE_FLAG_REFRESH_MS,
	FeatureFlagGate,
	FeatureFlagsProvider,
	StaticFeatureFlagsProvider,
	useDynamicConfig,
	useEnabledFeatureFlags,
	useFeatureFlag,
	type FeatureFlagGateProps,
	type FeatureFlagsProviderProps,
	type StaticFeatureFlagsProviderProps,
} from "./feature-flags-provider";

/** The Analytics tab (`src/app/(app)/analytics.tsx`): its tab, its drawer link and the screen carry this flag. */
export const MOBILE_ANALYTICS_FEATURE: FeatureFlagKey = "mobile-analytics";

/** Every flag the mobile app reads. */
export const MOBILE_FEATURE_FLAGS: readonly FeatureFlagKey[] = featureFlagKeysFor("mobile");
