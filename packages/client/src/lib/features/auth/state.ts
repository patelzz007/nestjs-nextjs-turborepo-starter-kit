import type { EnrollmentReason, SessionScope } from "@workspace/shared";

import type { SessionCheckFailureReason } from "../../auth/session/session-check";

/**
 * Client auth session status — what THIS tab currently believes about its
 * session, for rendering only. Owner: Zustand, because the login form, the
 * shells, the cross-tab channel and the 401 pipeline all coordinate through it.
 *
 * The httpOnly session cookies and the API are the only authority: this state
 * never authorizes anything, holds no token, and is never persisted (each tab
 * starts `unknown` and learns its status from `/auth/me` or a sign-in).
 *
 * NOT here, deliberately:
 * - the user's profile (only its id, as the session's subject) — server state owned by TanStack Query (`GET /auth/me`).
 *   A sign-in seeds that cache from the login response (`effects.ts`), and the
 *   facade composes the `AuthUser` view from the query + this state;
 * - capabilities / permissions and the session's SCOPE (full / restricted +
 *   enrollment reason) — `GET /auth/permissions` (TanStack Query), which
 *   mirrors the access token. The facade derives the scope from that query;
 *   until it has answered the scope is `pending` and the UI fails closed;
 * - `isAuthenticated` / `isLoading` — derived from `status` by the selectors.
 */
export type AuthSessionState = AuthSessionStatus & {
	/**
	 * Session boundaries this tab has crossed. `0` is the session the server
	 * rendered the page for. Every sign-in, every way of losing the session and
	 * every change of identity adds one. Server-rendered session data
	 * (`initialData`) is only valid at epoch 0, and a session check that started
	 * in an earlier epoch is stale and must not apply.
	 */
	readonly epoch: number;
	/**
	 * Whether the latest session check reached a verdict. Kept apart from
	 * `status` on purpose: an unreachable API is not a fact about the session,
	 * so it never changes `status` — an `authenticated` tab stays authenticated,
	 * an `unknown` one stays unknown (never signed out). It only tells the UI
	 * why the status could not be confirmed, and drives the retries.
	 */
	readonly check: SessionCheckState;
};

/**
 * The session check's own progress — not the session's.
 *
 * Retries are counted per series: a verdict or a session boundary ends the
 * series (`ok`); a trigger (back online, tab visible, "Try again") starts a
 * new one.
 */
export type SessionCheckState =
	/** No failed check to report: none failed since the last verdict (or none ran yet). */
	| { readonly status: "ok" }
	/** The latest check reached no verdict; the tab checks again by itself (backoff). */
	| { readonly status: "retrying"; readonly reason: SessionCheckFailureReason; readonly failedAttempts: number }
	/** The retry budget is spent; the tab checks again only on a trigger. */
	| { readonly status: "paused"; readonly reason: SessionCheckFailureReason; readonly failedAttempts: number };

/** What starts a new series of session checks after the API was unreachable. */
export type SessionRecheckTrigger = "online" | "visible" | "manual";

export type AuthSessionStatus =
	/** Not known yet: the first render (server and client) before the session check settles. */
	| { readonly status: "unknown" }
	/**
	 * The server confirmed a session — at sign-in or by answering `/auth/me`.
	 * `userId` is the session's subject (the JWT `sub`), kept to detect an
	 * identity change; the rest of the profile stays in the `/auth/me` query.
	 */
	| { readonly status: "authenticated"; readonly userId: string }
	/** No session in this tab, and why. */
	| { readonly status: "signed-out"; readonly reason: SignedOutReason };

/**
 * What kind of session this is — the access token's `sessionScope` claim as
 * `/auth/permissions` reports it. Derived by the facade from that query, never
 * stored: `pending` until the query has answered for the current session, and
 * a pending scope is treated as restricted (fail closed).
 */
export type AuthSessionScope =
	{ readonly sessionScope: SessionScope; readonly enrollmentReason: EnrollmentReason | null } | { readonly sessionScope: "pending"; readonly enrollmentReason: null };

/**
 * - `no-session` — the check found no session (guest, or `/auth/me` answered
 *   without one), or the route skips the check.
 * - `signed-out` — the member signed out in this tab.
 * - `session-expired` — a request was still 401 after the silent refresh.
 * - `signed-out-in-another-tab` — another tab on the same cookie set signed out.
 *
 * Every reason except `no-session` means this tab invalidated its session: the
 * silent refresh stays off until a new sign-in or a successful revalidation.
 */
export type SignedOutReason = "no-session" | "signed-out" | "session-expired" | "signed-out-in-another-tab";

/** The epoch of the session the server rendered the page for. */
export const SERVER_RENDERED_SESSION_EPOCH = 0;

/** No failed check to report. One shared value, so an unchanged check keeps its identity across transitions. */
export const SESSION_CHECK_OK: SessionCheckState = { status: "ok" };

export const INITIAL_AUTH_SESSION_STATE: AuthSessionState = { status: "unknown", epoch: SERVER_RENDERED_SESSION_EPOCH, check: SESSION_CHECK_OK };
