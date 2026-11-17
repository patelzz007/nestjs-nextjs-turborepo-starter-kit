import { featureFlagKeysFor, type FeatureFlagKey } from "@workspace/shared";

/** The customer's own activity page (`/dashboard/activity`): its route rule and links carry this flag (ADR 087). */
export const WEB_ACTIVITY_FEATURE: FeatureFlagKey = "web-activity";

/** Every flag the web app reads. */
export const WEB_FEATURE_FLAGS: readonly FeatureFlagKey[] = featureFlagKeysFor("web");
