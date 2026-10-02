import type { SessionPermissionsResponse, UserResponse } from "@workspace/shared";

import type { SessionCheckFailureReason } from "../../auth/session/session-check";
import type { AuthSessionScope, SessionRecheckTrigger } from "./state";

/**
 * Everything that can happen to the client session — the Redux DevTools
 * timeline reads as these. Payloads carry server responses the API already
 * returned to the browser (profile, permissions, scope); never a token — the
 * tokens live only in httpOnly cookies.
 */
export type AuthAction =
	/** The member signed in in this tab (login form, team invite, post-verification sync). */
	| { readonly type: "[ Auth ] Session Established"; readonly profile: UserResponse; readonly scope: AuthSessionScope }
	/** The session check (`/auth/me` + `/auth/permissions`) found a live session. */
	| { readonly type: "[ Auth ] Session Restored"; readonly profile: UserResponse; readonly permissions: SessionPermissionsResponse | null }
	/** The session check answered without a session. */
	| { readonly type: "[ Auth ] Session Not Found" }
	/**
	 * The session check reached no verdict (the API was unreachable, slow, or
	 * answered outside its contract). Not a fact about the session: the status
	 * is kept. Carries the category only.
	 */
	| { readonly type: "[ Auth ] Session Check Failed"; readonly reason: SessionCheckFailureReason }
	/** Something suggests the API may be reachable again (back online, tab visible, "Try again"): start a new series of checks. */
	| { readonly type: "[ Auth ] Session Recheck Requested"; readonly trigger: SessionRecheckTrigger }
	/** This route does not check the session (auth pages), or the server saw no session cookie. */
	| { readonly type: "[ Auth ] Session Check Skipped" }
	/** The live `/auth/permissions` answer reports a different scope than this tab holds. */
	| { readonly type: "[ Auth ] Session Scope Changed"; readonly scope: AuthSessionScope }
	/** The email was verified but the session could not be re-read — apply the known outcome. */
	| { readonly type: "[ Auth ] Email Verified" }
	/** The member signed out in this tab. */
	| { readonly type: "[ Auth ] Signed Out" }
	/** A request was still 401 after the silent refresh. */
	| { readonly type: "[ Auth ] Session Expired" }
	/** Another tab on the same cookie set signed out. */
	| { readonly type: "[ Auth ] Signed Out In Another Tab" }
	/** `POST /auth/logout` finished: the httpOnly cookies are gone server-side. */
	| { readonly type: "[ Auth ] Server Session Cleared"; readonly notifyOtherTabs: boolean };

/** Action creators — the only way the facade describes what happened. */
export const authActions = {
	sessionEstablished: (profile: UserResponse, scope: AuthSessionScope): AuthAction => ({ type: "[ Auth ] Session Established", profile, scope }),
	sessionRestored: (profile: UserResponse, permissions: SessionPermissionsResponse | null): AuthAction => ({
		type: "[ Auth ] Session Restored",
		profile,
		permissions,
	}),
	sessionNotFound: (): AuthAction => ({ type: "[ Auth ] Session Not Found" }),
	sessionCheckFailed: (reason: SessionCheckFailureReason): AuthAction => ({ type: "[ Auth ] Session Check Failed", reason }),
	sessionRecheckRequested: (trigger: SessionRecheckTrigger): AuthAction => ({ type: "[ Auth ] Session Recheck Requested", trigger }),
	sessionCheckSkipped: (): AuthAction => ({ type: "[ Auth ] Session Check Skipped" }),
	sessionScopeChanged: (scope: AuthSessionScope): AuthAction => ({ type: "[ Auth ] Session Scope Changed", scope }),
	emailVerified: (): AuthAction => ({ type: "[ Auth ] Email Verified" }),
	signedOut: (): AuthAction => ({ type: "[ Auth ] Signed Out" }),
	sessionExpired: (): AuthAction => ({ type: "[ Auth ] Session Expired" }),
	signedOutInAnotherTab: (): AuthAction => ({ type: "[ Auth ] Signed Out In Another Tab" }),
	serverSessionCleared: (notifyOtherTabs: boolean): AuthAction => ({ type: "[ Auth ] Server Session Cleared", notifyOtherTabs }),
};
