/**
 * Flags enabled for this deployment, matched against `featureFlag` in
 * `lib/navigation/sidebar-menu.json` and the route-authorization rules.
 * Evaluated on the server (env vars are not exposed to the browser) and
 * passed to the client shell as data. Feature flags are orthogonal to
 * authorization: an item shows only when the permission is allowed AND its
 * feature is enabled. No features are currently flagged.
 */
export function resolveEnabledFeatureFlags(): readonly string[] {
	return [];
}
