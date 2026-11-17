import type { ApiFeatureFlagKey } from "@workspace/shared";

/**
 * Whether a deployment-wide flag the API itself decides on is on (customer tiers, ADR 085): the stored setting, else
 * the flag's default (`API_FEATURE_FLAG_DEFAULTS`). Decided for everyone at once, so a PERCENTAGE setting reads as off.
 * Exported through `public-api.ts`; read under `feature_flags.evaluate`, which sees nothing but the flags.
 */
export interface ApiFeatureFlags {
	isOn(key: ApiFeatureFlagKey): Promise<boolean>;
}

export const API_FEATURE_FLAGS = Symbol("API_FEATURE_FLAGS");
