import type { AdminServerEnv } from "@/lib/env/env.schema";

/** The developer component gallery (`/components`): its sidebar item carries this flag. */
export const COMPONENT_GALLERY_FEATURE = "component-gallery";

/** The server config the flags are decided from. */
export type FeatureFlagEnv = Pick<AdminServerEnv, "NODE_ENV" | "ADMIN_COMPONENT_GALLERY">;

/**
 * Whether this deployment serves the component gallery: `ADMIN_COMPONENT_GALLERY` when it is set,
 * otherwise every build except production. It is a developer tool, not part of the admin product.
 */
export function isComponentGalleryEnabled(env: FeatureFlagEnv): boolean {
	return env.ADMIN_COMPONENT_GALLERY === undefined ? env.NODE_ENV !== "production" : env.ADMIN_COMPONENT_GALLERY === "true";
}

/**
 * Flags enabled for this deployment, matched against `featureFlag` in
 * `lib/navigation/sidebar-menu.json`. Evaluated on the server (env vars are not
 * exposed to the browser) and passed to the client shell as data. Feature flags
 * are orthogonal to authorization: an item shows only when the permission is
 * allowed AND its feature is enabled. A flagged route also refuses itself
 * (`app/(panel)/components/layout.tsx` answers 404 while the gallery is off).
 */
export function resolveEnabledFeatureFlags(env: FeatureFlagEnv): readonly string[] {
	return isComponentGalleryEnabled(env) ? [COMPONENT_GALLERY_FEATURE] : [];
}
