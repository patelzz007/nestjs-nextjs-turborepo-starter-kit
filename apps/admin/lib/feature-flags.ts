import { evaluateFeatureFlag, type FeatureFlagKey, type FeatureFlagSetting, type PlatformFeatureFlagKey } from "@workspace/shared";

import type { AdminServerEnv } from "@/lib/env/env.schema";

/** The sidebar's Components section (`/components`): the developer gallery and the kanban board. Its sidebar group carries this flag. */
export const COMPONENT_GALLERY_FEATURE: PlatformFeatureFlagKey = "component-gallery";

/** Merchant invites (`/merchants/invites`): off on a single-tenant deployment, which serves only its seeded tenant. */
export const MERCHANT_INVITES_FEATURE: PlatformFeatureFlagKey = "merchant-invites";

/** What the API says about this deployment, beside the admin's own server config. */
export interface DeploymentFeatures {
	/** `GET /admin/invites/availability` did not answer "no" (see `isMerchantInvitingOffered`). */
	readonly merchantInvitesOffered: boolean;
}

/** The server config the flags are decided from. */
export type FeatureFlagEnv = Pick<AdminServerEnv, "NODE_ENV" | "ADMIN_COMPONENT_GALLERY">;

/**
 * Whether this deployment serves the component gallery: `ADMIN_COMPONENT_GALLERY` when it is set,
 * otherwise every build except production. It is a developer tool, not part of the admin product.
 */
export function isComponentGalleryEnabled(env: FeatureFlagEnv): boolean {
	return env.ADMIN_COMPONENT_GALLERY === undefined ? env.NODE_ENV !== "production" : env.ADMIN_COMPONENT_GALLERY === "true";
}

/** Who the flags are evaluated for, and what staff set at runtime (enhancement 5.6). */
export interface FeatureFlagContext {
	/** The stored settings (`GET /admin/feature-flags/settings`); empty when the API couldn't answer. */
	readonly settings: readonly FeatureFlagSetting[];
	/** The signed-in staff member, for a percentage rollout; null before the session is known. */
	readonly subjectId: string | null;
}

/**
 * Flags enabled for this deployment, matched against `featureFlag` in
 * `lib/navigation/sidebar-menu.json`. Evaluated on the server (env vars are not
 * exposed to the browser, and the API's answers are fetched there) and passed
 * to the client shell as data. Feature flags
 * are orthogonal to authorization: an item shows only when the permission is
 * allowed AND its feature is enabled. A flagged route also refuses itself
 * (`app/(panel)/components/(gallery)/layout.tsx` answers 404 while the gallery is off).
 */
export function resolveEnabledFeatureFlags(
	env: FeatureFlagEnv,
	deployment: DeploymentFeatures,
	context: FeatureFlagContext = { settings: [], subjectId: null },
): readonly string[] {
	// Each flag's default is the deployment fact it always was; a runtime setting (5.6) decides over it. Only the
	// deployment-wide flags gate the console: a store flag (5.11) is decided where the store acts (its till), not here.
	const defaults: Readonly<Record<PlatformFeatureFlagKey, boolean>> = {
		"component-gallery": isComponentGalleryEnabled(env),
		"merchant-invites": deployment.merchantInvitesOffered,
	};
	const settingOf = (key: FeatureFlagKey): FeatureFlagSetting | undefined => context.settings.find((setting) => setting.key === key);
	const keys: readonly PlatformFeatureFlagKey[] = [COMPONENT_GALLERY_FEATURE, MERCHANT_INVITES_FEATURE];
	return keys.filter((key) => evaluateFeatureFlag(key, settingOf(key), defaults[key], context.subjectId));
}
