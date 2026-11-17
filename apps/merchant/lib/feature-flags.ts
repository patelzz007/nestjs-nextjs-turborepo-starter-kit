import { featureFlagKeysFor, type FeatureFlagKey } from "@workspace/shared";

/** The merchant console's Analytics pages (`/t/[slug]/analytics`): its sidebar item and page carry this flag (ADR 087). */
export const MERCHANT_ANALYTICS_FEATURE: FeatureFlagKey = "merchant-analytics";

/** Every flag the merchant console reads: matched against `featureFlag` in `lib/navigation/merchant-sidebar-menu.json`. */
export const MERCHANT_FEATURE_FLAGS: readonly FeatureFlagKey[] = featureFlagKeysFor("merchant");
