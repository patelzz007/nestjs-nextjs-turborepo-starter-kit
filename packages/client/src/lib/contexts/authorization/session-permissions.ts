// ============================================
// lib/contexts/authorization/session-permissions.ts - how every web app polls and trusts `GET /auth/permissions`
// ============================================
// Each app owns its own session-permissions hook (the admin reports a load
// failure, the web app knows guests), but they poll the endpoint the same way
// and trust its answers by the same rule, defined once here.

import type { CapabilitySlug, SessionPermissionsResponse } from "@workspace/shared";

/** Re-checks revocations promptly without hammering the API. */
export const SESSION_PERMISSIONS_REFETCH_INTERVAL_MS = 60_000;

/** How long an answer counts as fresh: a remount within it reads the cache. */
export const SESSION_PERMISSIONS_STALE_TIME_MS = 30_000;

/** The polling every app's `GET /auth/permissions` query uses (one retry, fresh on focus, every minute). */
export const SESSION_PERMISSIONS_QUERY_OPTIONS = {
	retry: 1,
	staleTime: SESSION_PERMISSIONS_STALE_TIME_MS,
	refetchOnWindowFocus: true,
	refetchInterval: SESSION_PERMISSIONS_REFETCH_INTERVAL_MS,
} satisfies { readonly retry: number; readonly staleTime: number; readonly refetchOnWindowFocus: boolean; readonly refetchInterval: number };

const NO_CAPABILITIES: readonly CapabilitySlug[] = [];

/**
 * Picks the capability list to trust. The live query wins whenever it has
 * data — **even an empty list**, so permissions revoked to zero disappear —
 * and the server-preloaded list is used only before the first live answer.
 */
export function resolveSessionCapabilities(live: SessionPermissionsResponse | undefined, preloaded: SessionPermissionsResponse | undefined): readonly CapabilitySlug[] {
	if (live !== undefined) {
		return live.capabilities;
	}
	return preloaded?.capabilities ?? NO_CAPABILITIES;
}
