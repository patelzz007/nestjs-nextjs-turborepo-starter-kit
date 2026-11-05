// API path templates owned by the `feature-flags` context (enhancement 5.6). Composed into `apiRoutes`.

import type { RouteTree } from "../../route-tree";

export const featureFlagsRoutes = {
	/** Every flag with its setting and who last changed it (FEATURE_FLAG:LIST). */
	list: "/admin/feature-flags",
	/** The settings alone, for the apps to evaluate: any admin staff member. */
	settings: "/admin/feature-flags/settings",
	/** Changing one flag (FEATURE_FLAG:UPDATE). */
	flag: "/admin/feature-flags/:key",
	/** The stores a store flag can be set for: merchants by name, with their branches (FEATURE_FLAG:UPDATE). */
	stores: "/admin/feature-flags/stores",
	/** A store flag's per-store settings (FEATURE_FLAG:LIST to read, UPDATE to set; enhancement 5.11). */
	overrides: "/admin/feature-flags/:key/overrides",
	/** Removing one store's setting, with why (FEATURE_FLAG:UPDATE): a POST, so the reason can't be dropped as a DELETE body can. */
	removeOverride: "/admin/feature-flags/:key/overrides/:overrideId/remove",
} satisfies Record<string, RouteTree>;
