import { assertNever, type Envelope, type SessionPermissionsResponse, type UserResponse } from "@workspace/shared";

import type { AuthSyncEvent } from "../../auth/session/sync";
import type { FeatureEffect } from "../../state/feature-store";
import type { AuthAction } from "./actions";
import type { AuthSessionState } from "./state";

/**
 * The session's slice of the TanStack Query cache — the browser
 * implementation is `createAuthQueryCache` (`lib/auth/session/auth-query-cache.ts`),
 * a fake in tests.
 */
export interface AuthQueryCache {
	/** The id of the profile cached in `/auth/me` — whose data the cache currently holds — or `null`. */
	readonly readProfileId: () => string | null;
	/** Writes a profile the server just returned (with that response's real `meta`) into the `/auth/me` query. */
	readonly seedProfile: (profile: Envelope<UserResponse>) => void;
	/** Writes a `/auth/permissions` answer the server just returned into its query. */
	readonly seedSessionPermissions: (permissions: Envelope<SessionPermissionsResponse>) => void;
	/** Drops the cached `/auth/permissions` answer, so the next read fetches the new session's. */
	readonly dropSessionPermissions: () => void;
	/** Cancels in-flight queries and drops every cached query and mutation of the previous session. */
	readonly clear: () => void;
}

/** Posts to the other tabs sharing this cookie set (a `BroadcastChannel`; a fake in tests). */
export interface AuthBroadcaster {
	readonly post: (event: AuthSyncEvent) => void;
}

/** Another member's data is in the cache: drop all of it before anything of `userId` is written. */
function clearIfAnotherIdentity(cache: AuthQueryCache, userId: string): void {
	const cachedUserId = cache.readProfileId();
	if (cachedUserId !== null && cachedUserId !== userId) {
		cache.clear();
	}
}

/**
 * Keeps the query cache in step with the session. The guarantee: the cache
 * never holds one session's data while another session (or none) is current.
 * - A sign-in or a restored session seeds `/auth/me` (and `/auth/permissions`)
 *   with the answers the server just gave, so the profile is never fetched
 *   twice and is never copied into the store.
 * - A different identity (another member signed in, in this tab or another)
 *   clears the whole cache first.
 * - A sign-in drops the cached permissions even for the same member: they
 *   described the previous session.
 * - Every way of losing the session clears the cache synchronously, before the
 *   flow continues (`POST /auth/logout`, navigation), so no in-flight query
 *   keeps retrying. That includes a session check that no longer finds the
 *   session this tab had.
 * - A session check that reached no verdict (API unreachable) touches nothing:
 *   the session is not lost, so its data stays.
 */
export function createAuthQueryCacheEffect(cache: AuthQueryCache): FeatureEffect<AuthSessionState, AuthAction> {
	return (action: AuthAction): void => {
		switch (action.type) {
			case "[ Auth ] Session Established":
				clearIfAnotherIdentity(cache, action.profile.data.id);
				cache.dropSessionPermissions();
				cache.seedProfile(action.profile);
				return;
			case "[ Auth ] Session Restored":
				clearIfAnotherIdentity(cache, action.profile.data.id);
				cache.seedProfile(action.profile);
				if (action.permissions !== null) {
					cache.seedSessionPermissions(action.permissions);
				}
				return;
			case "[ Auth ] Session Not Found":
				// Whoever the cached profile was, the server no longer confirms them.
				if (cache.readProfileId() !== null) {
					cache.clear();
				}
				return;
			case "[ Auth ] Signed Out":
			case "[ Auth ] Session Expired":
			case "[ Auth ] Signed Out In Another Tab":
				cache.clear();
				return;
			case "[ Auth ] Session Check Failed":
			case "[ Auth ] Session Recheck Requested":
			case "[ Auth ] Session Check Skipped":
			case "[ Auth ] Server Session Cleared":
				return;
			default:
				assertNever(action, "auth action");
		}
	};
}

/**
 * Tells the other tabs (same cookie set) what happened — event names only,
 * never a token or profile:
 * - a sign-in in this tab (including the re-read after email verification) → `logged-in`,
 *   so they re-check the session instead of bouncing to the login page;
 * - the server cookies are cleared → `logged-out`, so they drop their session
 *   too. Sent only AFTER `POST /auth/logout` returns (never before the server
 *   session is gone), and only when the flow asks (`notifyOtherTabs`).
 *
 * A restored session or a failed check is not broadcast: other
 * tabs read the same cookies and run their own checks (and their own retries,
 * so one tab's outage never fans out into requests from every tab).
 */
export function createAuthTabSyncEffect(broadcaster: AuthBroadcaster): FeatureEffect<AuthSessionState, AuthAction> {
	return (action: AuthAction): void => {
		switch (action.type) {
			case "[ Auth ] Session Established":
				broadcaster.post("logged-in");
				return;
			case "[ Auth ] Server Session Cleared":
				if (action.notifyOtherTabs) {
					broadcaster.post("logged-out");
				}
				return;
			case "[ Auth ] Session Restored":
			case "[ Auth ] Session Not Found":
			case "[ Auth ] Session Check Failed":
			case "[ Auth ] Session Recheck Requested":
			case "[ Auth ] Session Check Skipped":
			case "[ Auth ] Signed Out":
			case "[ Auth ] Session Expired":
			case "[ Auth ] Signed Out In Another Tab":
				return;
			default:
				assertNever(action, "auth action");
		}
	};
}
