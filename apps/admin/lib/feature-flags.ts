import { featureFlagKeysFor, isFlagOn, type FeatureFlagBundle, type FeatureFlagKey } from "@workspace/shared";

/** The sidebar's Components section (`/components`): the developer showcase and the kanban board. Its sidebar group carries this flag. */
export const SHOWCASE_FEATURE: FeatureFlagKey = "showcase";

/** Merchant invites (`/merchants/invites`): off on a single-tenant deployment, which serves only its seeded tenant. */
export const MERCHANT_INVITES_FEATURE: FeatureFlagKey = "merchant-invites";

/** Customer tiers (ADR 085): the tier rules page under Settings shows only while tiers are on. */
export const CUSTOMER_TIERS_FEATURE: FeatureFlagKey = "customer-tiers";

/** What the API says about this deployment, beside the flags. */
export interface DeploymentFeatures {
	/** `GET /admin/invites/availability` did not answer "no" (see `isMerchantInvitingOffered`). */
	readonly merchantInvitesOffered: boolean;
}

/**
 * The admin flags on for this request's staff member (ADR 087), matched against `featureFlag` in
 * `lib/navigation/sidebar-menu.json` and the flagged routes. The API works each flag out (the bundle); without a
 * bundle (the API couldn't answer) every flag reads as its code default, so a read failure never turns anything on.
 * Merchant invites also need a deployment that serves more than one tenant, whatever the flag says. Feature flags
 * are orthogonal to authorization: an item shows only when the permission is allowed AND its feature is on.
 */
export function enabledAdminFeatureFlags(bundle: FeatureFlagBundle | null, deployment: DeploymentFeatures): readonly FeatureFlagKey[] {
	return featureFlagKeysFor("admin").filter((key) => isFlagOn(bundle, key) && (key !== MERCHANT_INVITES_FEATURE || deployment.merchantInvitesOffered));
}
