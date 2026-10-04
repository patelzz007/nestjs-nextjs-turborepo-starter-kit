import { SERVER_RENDERED_SESSION_EPOCH, type AuthSessionState, type SessionCheckState, type SignedOutReason } from "./state";

export function selectAuthStatus(state: AuthSessionState): AuthSessionState["status"] {
	return state.status;
}

export function selectIsAuthenticated(state: AuthSessionState): boolean {
	return state.status === "authenticated";
}

/**
 * True while the session status is unknown (`useAuth().isLoading`): the first
 * check is in flight, or it could not reach the API yet. It stays true through
 * an outage on purpose — consumers read `isLoading === false && user === null`
 * as "signed out", and a transient failure must never render as signed out.
 * Whether the check is still running or failing is `selectSessionCheck`.
 */
export function selectIsSessionPending(state: AuthSessionState): boolean {
	return state.status === "unknown";
}

/** Whether the latest session check reached a verdict, and if not, whether the tab retries by itself. */
export function selectSessionCheck(state: AuthSessionState): SessionCheckState {
	return state.check;
}

export function selectSignedOutReason(state: AuthSessionState): SignedOutReason | null {
	return state.status === "signed-out" ? state.reason : null;
}

/**
 * This tab invalidated its session (signed out, expired, or signed out
 * elsewhere): the silent refresh must not run and a second invalidation is a
 * no-op, until a sign-in or a successful session check.
 */
export function selectIsSessionInvalidated(state: AuthSessionState): boolean {
	return state.status === "signed-out" && state.reason !== "no-session";
}

/** The session's subject (user id) while authenticated; `null` otherwise. */
export function selectSessionUserId(state: AuthSessionState): string | null {
	return state.status === "authenticated" ? state.userId : null;
}

export function selectSessionEpoch(state: AuthSessionState): number {
	return state.epoch;
}

/**
 * Still on the session the server rendered the page for — no sign-in, sign-out
 * or identity change since. Only then may server-rendered session data seed a
 * query (`initialData`); afterwards it belongs to a session that is gone.
 */
export function selectIsServerRenderedSession(state: AuthSessionState): boolean {
	return state.epoch === SERVER_RENDERED_SESSION_EPOCH;
}
