import type { FeatureFlagKey } from "@workspace/shared";

/** Who a server-side flag check is for: whatever the calling context knows (nothing, for a deployment-wide answer). */
export interface FlagCheckSubject {
	readonly userId: string | null;
	readonly tenantId: string | null;
	readonly locationId: string | null;
}

/** A deployment-wide check: no person or store, so rules about one, and shares, don't apply. */
export const DEPLOYMENT_WIDE: FlagCheckSubject = { userId: null, tenantId: null, locationId: null };

/**
 * Whether a feature flag is on, for the contexts that decide on one server-side (a till's redemption, customer
 * tiers, `@RequireFeatureFlag`). Exported through `public-api.ts`; worked out from the cached catalogue.
 */
export interface FeatureFlags {
	isOn(key: FeatureFlagKey, subject: FlagCheckSubject): Promise<boolean>;
}

export const FEATURE_FLAGS = Symbol("FEATURE_FLAGS");
