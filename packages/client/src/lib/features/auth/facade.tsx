"use client";

import { useQueryClient } from "@tanstack/react-query";
import { assertNever, type ApiResponseMeta, type AuthClientType, type UserResponse } from "@workspace/shared";
import * as React from "react";

import { API_BASE_URL } from "../../api/config";
import { apiRouter, type ApiRouter } from "../../api/endpoints";
import {
	createApiRequestContext,
	createRefreshCooldown,
	createUncheckedApiRequestContext,
	fetchMutationUnchecked,
	fetchQuery,
	useApi,
	type ApiClient,
	type RefreshCall,
	type RefreshResult,
} from "../../api/use-api";
import { createAuthQueryCache } from "../../auth/session/auth-query-cache";
import { composeAuthUser, resolveSessionScope, type AuthUser } from "../../auth/session/session";
import {
	checkSession,
	SESSION_CHECK_TIMEOUT_MS,
	sessionCheckRetryDelayMs,
	sessionRecheckJitterMs,
	type SessionCheckProblem,
	type SessionCheckResponses,
	type SessionCheckResult,
} from "../../auth/session/session-check";
import { createAuthChannel, type AuthChannel, type AuthSyncEvent } from "../../auth/session/sync";
import { createFeatureStoreContext } from "../../state/feature-store-context";
import { authActions, type AuthAction } from "./actions";
import type { AuthBroadcaster } from "./effects";
import {
	selectAuthStatus,
	selectIsAuthenticated,
	selectIsServerRenderedSession,
	selectIsSessionInvalidated,
	selectIsSessionPending,
	selectSessionCheck,
	selectSessionEpoch,
} from "./selectors";
import type { AuthSessionState, SessionCheckState, SessionRecheckTrigger } from "./state";
import { createAuthStore, type AuthStore } from "./store";

/**
 * Auth feature API — components use ONLY this module (re-exported from
 * `@workspace/client/lib/auth`): `useAuth()` for the full facade, or the narrow
 * hooks (`useAuthUser`, `useIsAuthenticated`, `useAuthStatus`,
 * `useAuthCommands`) in new code.
 *
 * Who owns what:
 * - session STATUS (unknown / authenticated / signed out + why) — the auth
 *   feature store, one per provider mount;
 * - the profile — TanStack Query (`GET /auth/me`), seeded from the login
 *   response so it is never fetched twice and never copied into the store;
 * - the session scope — TanStack Query (`GET /auth/permissions`), `pending`
 *   (treated as restricted) until it answers for the current session;
 * - the `AuthUser` view — composed here from those, never stored;
 * - authentication itself — the httpOnly cookies and the API. Nothing in this
 *   module authorizes anything.
 */

const authContext = createFeatureStoreContext<AuthSessionState, AuthAction>("Auth");
const AuthStoreProvider = authContext.provider;

/** `/auth/me` and `/auth/permissions` are re-read at most once a minute by the session queries. */
const SESSION_QUERY_STALE_TIME_MS = 60_000;

/**
 * Retries of the live `/auth/permissions` query. The session scope comes from
 * it, so a failed read leaves the scope pending (restricted) — it is retried
 * (TanStack Query's exponential backoff) instead of being given up.
 */
const SESSION_PERMISSIONS_QUERY_RETRIES = 5;

/** Prefix of the cross-tab channel; one channel per frontend (= cookie set). */
const AUTH_CHANNEL_PREFIX = "auth-sync:";

/** What a refresh that may not run reports: the tab invalidated its session, or the check asking is stale. */
const REFRESH_NOT_ALLOWED: RefreshResult = "expired";

/**
 * Whether a session check may run now. A hidden tab or an offline browser
 * waits instead of retrying — nobody is looking, or the request cannot
 * succeed — and `visibilitychange` / `online` resume it. Browser-only: called
 * from effects, timers and event handlers, never during render.
 */
function canCheckSessionNow(): boolean {
	return document.visibilityState !== "hidden" && navigator.onLine;
}

/**
 * Reports a session answer that broke the API contract. There is no client
 * error-reporting pipeline yet, so this is the structured console warning the
 * other client flows use; the outage itself is not reported (it is expected,
 * and every tab would report it).
 */
function reportSessionCheckProblem(problem: SessionCheckProblem): void {
	console.warn("[auth] session check answer broke the API contract", { event: "auth.session_check.contract_problem", ...problem });
}

/** Session commands — one identity per provider mount (safe in effect deps). */
export interface AuthCommands {
	/**
	 * A sign-in succeeded. `profile` is the user the login response returned and
	 * `answeredBy` that response's `meta` (the cache is seeded with the real
	 * envelope). Tells the other tabs — the tokens are already in httpOnly
	 * cookies. The scope is read from `/auth/permissions`, never assumed.
	 */
	readonly login: (profile: UserResponse, answeredBy: ApiResponseMeta) => void;
	/** Signs out: clears the client session and cache, the server cookies, then redirects. */
	readonly logout: () => Promise<void>;
	/**
	 * Signs out EVERY device session of the account, on every client type and
	 * this one included (`POST /auth/logout-all`), then leaves like `logout`.
	 * Resolves `false` — and keeps this session — when the API did not confirm
	 * it, so the caller can say so instead of pretending.
	 */
	readonly logoutEverywhere: () => Promise<boolean>;
	/**
	 * Rotates the session cookies (`POST /auth/refresh`) through the tab's
	 * SINGLE-FLIGHT refresh — shared with the 401 pipeline and the session
	 * check, so concurrent callers never rotate the refresh token twice.
	 */
	readonly refreshSession: () => Promise<RefreshResult>;
	/**
	 * Checks the session again now, with a fresh retry budget — the member's
	 * "Try again" after the API was unreachable. A no-op on routes that do not
	 * check the session.
	 */
	readonly recheckSession: () => void;
}

export interface AuthContextType extends AuthCommands {
	/** The server confirmed a session for this tab. */
	readonly isAuthenticated: boolean;
	/** True until the first session check settles. */
	readonly isLoading: boolean;
	/** When false, child hooks should not call `GET /auth/me` (login / onboarding routes). */
	readonly sessionRevalidationEnabled: boolean;
	/** The signed-in user (profile from `/auth/me` + session scope), or null. */
	readonly user: AuthUser | null;
	readonly api: ApiClient<ApiRouter>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);
AuthContext.displayName = "AuthContext";

const AuthUserContext = React.createContext<AuthUser | null | undefined>(undefined);
AuthUserContext.displayName = "AuthUserContext";

const AuthCommandsContext = React.createContext<AuthCommands | undefined>(undefined);
AuthCommandsContext.displayName = "AuthCommandsContext";

export interface AuthProviderProps {
	readonly children: React.ReactNode;
	/**
	 * Base URL of the API. Defaults to the env-driven `API_BASE_URL`
	 * (see lib/config.ts) — override only when you need a per-call value.
	 */
	readonly baseUrl?: string | undefined;
	readonly onUnauthorizedRedirect?: string | undefined;
	/**
	 * Leaves the session's pages for `url` once the session is gone, and makes
	 * the server-rendered layouts render again without it (the Next.js bridge,
	 * `ClientAuthWrapper`, navigates and refreshes once the navigation has
	 * committed). Absent in tests and non-routing hosts.
	 */
	readonly leaveSession?: ((url: string) => void) | undefined;
	/**
	 * Which frontend this is — picks the isolated cookie set (`X-Client-Type`
	 * on every request) and names the cross-tab channel. Required: the API is
	 * never left to guess.
	 */
	readonly clientType: AuthClientType;
	/**
	 * When a 401 invalidates the session, navigation to `onUnauthorizedRedirect`
	 * only happens if this returns true. Defaults to always redirect.
	 */
	readonly shouldRedirectOnUnauthorized?: (() => boolean) | undefined;
	/**
	 * When false, skips the initial `GET /auth/me` on mount (e.g. login / onboarding).
	 * Re-runs when this transitions to true (navigating into the app).
	 */
	readonly revalidateSessionEnabled?: boolean | undefined;
	/**
	 * Whether the server saw a session cookie for this page. `false` skips ONLY
	 * the on-mount revalidation — a guest has no session to restore, and asking
	 * answered `/auth/me` + `/auth/permissions` with 401 on every page view.
	 * Cross-tab sync and the post-login session sync are unaffected. Becoming
	 * `true` (e.g. the layout re-renders after sign-in) revalidates.
	 */
	readonly sessionHint?: boolean | undefined;
}

/** The cross-tab channel as the store's effects see it: posts go to whichever channel is open. */
interface AuthTabLink extends AuthBroadcaster {
	/** Routes posts to `channel` until the returned detach runs. */
	readonly attach: (channel: AuthChannel) => () => void;
}

function createAuthTabLink(): AuthTabLink {
	let openChannel: AuthChannel | null = null;
	return {
		post: (event: AuthSyncEvent): void => {
			openChannel?.post(event);
		},
		attach: (channel: AuthChannel): (() => void) => {
			openChannel = channel;
			return (): void => {
				if (openChannel === channel) {
					openChannel = null;
				}
			};
		},
	};
}

/**
 * Mount once per app at the root (via `ClientAuthWrapper`), inside the
 * `QueryProvider`. Each mount owns its own store — per request on the server,
 * per tab in the browser — so no session state is ever shared between users.
 */
export function AuthProvider(props: AuthProviderProps): React.JSX.Element {
	const queryClient = useQueryClient();
	const [tabLink] = React.useState(createAuthTabLink);
	const devtoolsName = `Auth · ${props.clientType}`;
	const createStore = React.useCallback(
		(): AuthStore => createAuthStore({ devtoolsName, queryCache: createAuthQueryCache(queryClient), broadcaster: tabLink }),
		[devtoolsName, queryClient, tabLink],
	);

	return (
		<AuthStoreProvider createStore={createStore}>
			<AuthSession {...props} tabLink={tabLink} />
		</AuthStoreProvider>
	);
}

interface AuthSessionProps extends AuthProviderProps {
	readonly tabLink: AuthTabLink;
}

/** The session flows (check, refresh, sign-out, cross-tab) around the store — the auth feature's I/O. */
function AuthSession({
	children,
	baseUrl = API_BASE_URL,
	onUnauthorizedRedirect = "/auth/login",
	leaveSession,
	clientType,
	shouldRedirectOnUnauthorized,
	revalidateSessionEnabled = true,
	sessionHint = true,
	tabLink,
}: AuthSessionProps): React.JSX.Element {
	const store = authContext.useFeatureStore();
	const { dispatch, getState } = store;
	const isAuthenticated = authContext.useFeatureSelector(selectIsAuthenticated);
	const isLoading = authContext.useFeatureSelector(selectIsSessionPending);
	// Re-render at every session boundary — including ones that keep the status
	// "authenticated" (another member restored, the same member signing in
	// again). The effects cleared the query cache; without this render the
	// mounted session queries would keep showing the previous session's data.
	authContext.useFeatureSelector(selectSessionEpoch);

	// ── Silent refresh: concurrent 401s — and the session check — share ONE
	// refresh call, so the refresh token is only rotated once (rotation
	// invalidates the old token).
	const refreshPromiseRef = React.useRef<Promise<RefreshResult> | null>(null);

	const performRefresh = React.useCallback(async (): Promise<RefreshResult> => {
		try {
			// Uses `fetchMutationUnchecked` (not `useApi`) deliberately: refresh must not
			// re-enter the 401-refresh-unauthorized pipeline it drives. The procedure
			// def still comes from the typed endpoint registry.
			const uncheckedContext = createUncheckedApiRequestContext(baseUrl, clientType);
			const response = await fetchMutationUnchecked(uncheckedContext, apiRouter.auth.refresh, {});
			if (response.ok) return "ok";
			if (response.status === 401 || response.status === 403) return "expired";
			// Server reachable but broken (5xx) or a non-401 error.
			return "transient";
		} catch {
			// Network failure / API unreachable.
			return "transient";
		}
	}, [baseUrl, clientType]);

	// Wrap the raw refresh with a 30s cooldown on transient failures, so a dead
	// API is not re-hit on every 401 (mirrors the proxy's fall-through). The
	// instance is stable across renders (ref) so useApi's memo never re-creates.
	const cooldownRefreshRef = React.useRef<RefreshCall | null>(null);
	cooldownRefreshRef.current ??= createRefreshCooldown(performRefresh);
	const cooldownRefresh: RefreshCall = cooldownRefreshRef.current;

	const refreshOnce = React.useCallback((): Promise<RefreshResult> => {
		if (selectIsSessionInvalidated(getState())) {
			return Promise.resolve(REFRESH_NOT_ALLOWED);
		}
		// `??=` keeps single-flight semantics: the IIFE only runs while the ref is
		// null; concurrent callers share the same in-flight promise. `finally` resets
		// the ref to null once settled so a future 401 can refresh again.
		refreshPromiseRef.current ??= (async (): Promise<RefreshResult> => {
			try {
				return await cooldownRefresh();
			} finally {
				refreshPromiseRef.current = null;
			}
		})();
		return refreshPromiseRef.current;
	}, [cooldownRefresh, getState]);

	// ── Session check: `/auth/me` + `/auth/permissions` outside the 401 pipeline
	// (no exit sequence, no redirect). `checkSession` classifies the answer
	// (lib/auth/session/session-check.ts): a live session is restored, a dead one
	// reads as signed out, an expired access token gets ONE refresh through the
	// single flight above, and an unreachable API changes nothing but the check's
	// own state — then retries with capped, jittered backoff. Only the latest
	// check of the current epoch applies.
	const latestCheckRef = React.useRef<AbortController | null>(null);
	const scheduledCheckRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const revalidateSessionRef = React.useRef<() => Promise<void>>((): Promise<void> => Promise.resolve());
	const revalidationEnabledRef = React.useRef(revalidateSessionEnabled);
	React.useEffect((): void => {
		revalidationEnabledRef.current = revalidateSessionEnabled;
	}, [revalidateSessionEnabled]);

	const cancelScheduledCheck = React.useCallback((): void => {
		if (scheduledCheckRef.current !== null) {
			clearTimeout(scheduledCheckRef.current);
			scheduledCheckRef.current = null;
		}
	}, []);

	/** Stops the check in flight (its answer is dropped) and any scheduled one. */
	const stopSessionChecks = React.useCallback((): void => {
		cancelScheduledCheck();
		latestCheckRef.current?.abort();
		latestCheckRef.current = null;
	}, [cancelScheduledCheck]);

	const scheduleSessionCheck = React.useCallback(
		(delayMs: number): void => {
			cancelScheduledCheck();
			scheduledCheckRef.current = setTimeout((): void => {
				scheduledCheckRef.current = null;
				// Meanwhile a verdict or a session boundary arrived, the route stopped
				// checking, or the tab went hidden / offline (a trigger resumes it).
				if (selectSessionCheck(getState()).status === "ok" || !revalidationEnabledRef.current || !canCheckSessionNow()) {
					return;
				}
				void revalidateSessionRef.current();
			}, delayMs);
		},
		[cancelScheduledCheck, getState],
	);

	/** After a failed check: retry with backoff while the budget lasts; past it, wait for a trigger. */
	const retryAfterFailure = React.useCallback((): void => {
		const check = selectSessionCheck(getState());
		if (check.status !== "retrying" || !revalidationEnabledRef.current || !canCheckSessionNow()) {
			return;
		}
		scheduleSessionCheck(sessionCheckRetryDelayMs(check.failedAttempts, Math.random));
	}, [getState, scheduleSessionCheck]);

	const applySessionCheckResult = React.useCallback(
		(result: SessionCheckResult): void => {
			switch (result.kind) {
				case "valid":
					dispatch(authActions.sessionRestored(result.profile, result.permissions));
					return;
				case "no-session":
					dispatch(authActions.sessionNotFound());
					return;
				case "unavailable":
					// No verdict: the session status (and its cache) stays as it is.
					dispatch(authActions.sessionCheckFailed(result.reason));
					retryAfterFailure();
					return;
				default:
					assertNever(result, "session check result");
			}
		},
		[dispatch, retryAfterFailure],
	);

	const revalidateSession = React.useCallback(async (): Promise<void> => {
		// The newest check wins: it replaces a scheduled retry and aborts a check in flight.
		stopSessionChecks();
		const run = new AbortController();
		latestCheckRef.current = run;
		const startedInEpoch = selectSessionEpoch(getState());
		const isCurrent = (): boolean => latestCheckRef.current === run && selectSessionEpoch(getState()) === startedInEpoch;
		const requestContext = createApiRequestContext(baseUrl, clientType);

		const result = await checkSession(
			{
				readSession: async (signal: AbortSignal): Promise<SessionCheckResponses> => {
					const [me, permissions] = await Promise.all([
						fetchQuery(requestContext, apiRouter.auth.me, undefined, { signal }),
						fetchQuery(requestContext, apiRouter.auth.permissions, undefined, { signal }),
					]);
					return { me, permissions };
				},
				refresh: (): Promise<RefreshResult> => (isCurrent() ? refreshOnce() : Promise.resolve(REFRESH_NOT_ALLOWED)),
				report: reportSessionCheckProblem,
				timeoutMs: SESSION_CHECK_TIMEOUT_MS,
			},
			run.signal,
		);

		// A newer check, a sign-in or sign-out, or an unmount happened meanwhile: this
		// answer describes a session that is gone (e.g. a late 200 after logout).
		if (!isCurrent()) {
			return;
		}
		latestCheckRef.current = null;
		applySessionCheckResult(result);
	}, [applySessionCheckResult, baseUrl, clientType, getState, refreshOnce, stopSessionChecks]);

	React.useEffect((): void => {
		revalidateSessionRef.current = revalidateSession;
	}, [revalidateSession]);

	React.useEffect((): void => {
		if (revalidateSessionEnabled && sessionHint) {
			void revalidateSession();
			return;
		}
		cancelScheduledCheck();
		dispatch(authActions.sessionCheckSkipped());
	}, [cancelScheduledCheck, dispatch, revalidateSession, revalidateSessionEnabled, sessionHint]);

	// Every session boundary (sign-in, sign-out, another member) ends the checks
	// of the previous session; unmounting ends all of them.
	React.useEffect((): (() => void) => {
		const unsubscribe = store.subscribe((state: AuthSessionState, previousState: AuthSessionState): void => {
			if (state.epoch !== previousState.epoch) {
				stopSessionChecks();
			}
		});
		return (): void => {
			unsubscribe();
			stopSessionChecks();
		};
	}, [stopSessionChecks, store]);

	// Recovery triggers — only while the last check failed, so a healthy tab never
	// re-checks on them. Back online: the most likely moment the API is reachable
	// again. Visible again: hidden tabs do not retry (timers are throttled and
	// nobody is looking), so this is when the member needs a correct status. Both
	// start a new retry series after a short random delay, because every tab of
	// the browser sees the same event at the same moment.
	React.useEffect((): (() => void) => {
		const recheck = (trigger: SessionRecheckTrigger): void => {
			if (selectSessionCheck(getState()).status === "ok" || !revalidationEnabledRef.current || !canCheckSessionNow() || latestCheckRef.current !== null) {
				return;
			}
			dispatch(authActions.sessionRecheckRequested(trigger));
			scheduleSessionCheck(sessionRecheckJitterMs(Math.random));
		};
		const handleOnline = (): void => {
			recheck("online");
		};
		const handleVisibilityChange = (): void => {
			if (document.visibilityState === "visible") {
				recheck("visible");
			}
		};
		window.addEventListener("online", handleOnline);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return (): void => {
			window.removeEventListener("online", handleOnline);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [dispatch, getState, scheduleSessionCheck]);

	const recheckSession = React.useCallback((): void => {
		if (!revalidationEnabledRef.current) {
			return;
		}
		dispatch(authActions.sessionRecheckRequested("manual"));
		void revalidateSessionRef.current();
	}, [dispatch]);

	// ── Losing the session. The store's effects clear the query cache
	// synchronously inside `dispatch`, so it is empty before the next step.
	// Returns whether THIS call ended the session — only that caller runs the
	// exit sequence (server logout, broadcast, navigation), exactly once.
	const invalidateSession = React.useCallback(
		(invalidation: AuthAction): boolean => {
			if (selectIsSessionInvalidated(getState())) {
				return false;
			}
			dispatch(invalidation);
			return true;
		},
		[dispatch, getState],
	);

	const clearServerSession = React.useCallback(async (): Promise<void> => {
		try {
			const uncheckedContext = createUncheckedApiRequestContext(baseUrl, clientType);
			const response = await fetchMutationUnchecked(uncheckedContext, apiRouter.auth.logout, {});
			if (!response.ok) {
				console.error("Session clear request failed:", response.status);
			}
		} catch (error) {
			console.error("Session clear request failed:", error);
		}
	}, [baseUrl, clientType]);

	// The server cookies are gone: tell the other tabs (effect), then leave —
	// the host navigates and re-renders the server layouts without the session.
	const finalizeSessionExit = React.useCallback((): void => {
		dispatch(authActions.serverSessionCleared(true));
		leaveSession?.(onUnauthorizedRedirect);
	}, [dispatch, leaveSession, onUnauthorizedRedirect]);

	// Handle 401 responses from the API — clear httpOnly cookies server-side
	// before navigating so the route proxy does not bounce the user back into
	// the app with a stale (but not yet time-expired) access token.
	// Concurrent 401s each call this; the first one ends the session and runs
	// the exit once — the rest (and any later 401) find it already invalidated.
	const handleUnauthorized = React.useCallback(async (): Promise<void> => {
		if (!invalidateSession(authActions.sessionExpired())) {
			return;
		}
		await clearServerSession();
		const shouldRedirect = shouldRedirectOnUnauthorized?.() ?? true;
		if (shouldRedirect) {
			finalizeSessionExit();
			return;
		}
		// A guest-browsable page stays put and leaves the other tabs alone.
		dispatch(authActions.serverSessionCleared(false));
	}, [clearServerSession, dispatch, finalizeSessionExit, invalidateSession, shouldRedirectOnUnauthorized]);

	// Cookie auth + silent refresh on 401 for every typed API call.
	const api = useApi(apiRouter, baseUrl, clientType, handleUnauthorized, refreshOnce);

	// ── Commands.
	const login = React.useCallback(
		(profile: UserResponse, answeredBy: ApiResponseMeta): void => {
			dispatch(authActions.sessionEstablished({ success: true, data: profile, meta: answeredBy }));
		},
		[dispatch],
	);

	const signOut = React.useCallback(async (): Promise<void> => {
		// Stop mounted queries from retrying/refreshing before cookies are cleared.
		// A session that already expired still gets the server logout and the
		// exit, because the member asked to leave.
		invalidateSession(authActions.signedOut());
		await clearServerSession();
		finalizeSessionExit();
	}, [clearServerSession, finalizeSessionExit, invalidateSession]);

	const signOutEverywhere = React.useCallback(async (): Promise<boolean> => {
		try {
			const uncheckedContext = createUncheckedApiRequestContext(baseUrl, clientType);
			const response = await fetchMutationUnchecked(uncheckedContext, apiRouter.auth.logoutAll, {});
			if (!response.ok) {
				return false;
			}
		} catch (error) {
			console.error("Sign out everywhere failed:", error);
			return false;
		}
		// Every session is revoked and this tab's cookies are cleared by the API: leave.
		invalidateSession(authActions.signedOut());
		finalizeSessionExit();
		return true;
	}, [baseUrl, clientType, finalizeSessionExit, invalidateSession]);

	const signOutEverywhereRef = React.useRef(signOutEverywhere);
	React.useEffect((): void => {
		signOutEverywhereRef.current = signOutEverywhere;
	}, [signOutEverywhere]);
	const logoutEverywhere = React.useCallback((): Promise<boolean> => signOutEverywhereRef.current(), []);

	// `logout` keeps one identity for the provider's lifetime (the flow behind
	// it follows the route-dependent redirect rules), so effects may depend on it.
	const signOutRef = React.useRef(signOut);
	React.useEffect((): void => {
		signOutRef.current = signOut;
	}, [signOut]);
	const logout = React.useCallback((): Promise<void> => signOutRef.current(), []);

	// ── Cross-tab sync: another tab cleared the session (shared cookie jar), so
	// this tab drops the session and its cache AT ONCE — before any network
	// call — then bounces to login too, closing the rotation-race gap documented
	// in docs/technical/security/token-refresh.md. The server logout is repeated here because the
	// sender broadcasts even when its own `POST /auth/logout` failed; the
	// redirect waits for it so the route proxy cannot bounce back with a stale
	// cookie. `logged-in` makes this tab re-check its session.
	const handleTabEvent = React.useCallback(
		(event: AuthSyncEvent): void => {
			if (event === "logged-out") {
				if (!invalidateSession(authActions.signedOutInAnotherTab())) {
					return;
				}
				void (async (): Promise<void> => {
					await clearServerSession();
					if (shouldRedirectOnUnauthorized?.() ?? true) {
						leaveSession?.(onUnauthorizedRedirect);
					}
				})();
				return;
			}
			if (revalidateSessionEnabled) {
				void revalidateSession();
			}
		},
		[clearServerSession, invalidateSession, leaveSession, onUnauthorizedRedirect, revalidateSession, revalidateSessionEnabled, shouldRedirectOnUnauthorized],
	);

	const tabEventHandlerRef = React.useRef(handleTabEvent);
	React.useEffect((): void => {
		tabEventHandlerRef.current = handleTabEvent;
	}, [handleTabEvent]);

	// One channel per mount and cookie set, opened in the browser only and
	// closed on unmount; the handler is read through a ref so navigation never
	// re-opens it.
	const channelName = `${AUTH_CHANNEL_PREFIX}${clientType}`;
	React.useEffect((): (() => void) => {
		const channel = createAuthChannel(channelName);
		const detach = tabLink.attach(channel);
		const unsubscribe = channel.subscribe((event: AuthSyncEvent): void => {
			tabEventHandlerRef.current(event);
		});
		return (): void => {
			unsubscribe();
			detach();
			channel.close();
		};
	}, [channelName, tabLink]);

	// ── The profile and the scope: server state, read from the `/auth/me` and
	// `/auth/permissions` queries (seeded by sign-in and by the session check),
	// kept fresh while signed in. The permissions answer mirrors the access
	// token, so the scope follows the session (email verified, MFA enrolled)
	// without being copied anywhere; until it answers the scope is pending.
	// The cache is cleared at every session boundary, so a previous session's
	// answers cannot leak into this one.
	const sessionQueriesEnabled = isAuthenticated && revalidateSessionEnabled;
	const meQuery = api.auth.me.useQuery(undefined, { enabled: sessionQueriesEnabled, retry: false, staleTime: SESSION_QUERY_STALE_TIME_MS });
	const permissionsQuery = api.auth.permissions.useQuery(undefined, {
		enabled: sessionQueriesEnabled,
		retry: SESSION_PERMISSIONS_QUERY_RETRIES,
		staleTime: SESSION_QUERY_STALE_TIME_MS,
	});
	const profile = isAuthenticated ? meQuery.data?.data : undefined;
	const sessionPermissions = isAuthenticated ? permissionsQuery.data?.data : undefined;

	const user = React.useMemo(
		(): AuthUser | null => (profile === undefined ? null : composeAuthUser(profile, resolveSessionScope(sessionPermissions, profile.isEmailVerified))),
		[profile, sessionPermissions],
	);

	const refreshSession = React.useCallback((): Promise<RefreshResult> => refreshOnce(), [refreshOnce]);

	const commands = React.useMemo(
		(): AuthCommands => ({ login, logout, logoutEverywhere, refreshSession, recheckSession }),
		[login, logout, logoutEverywhere, recheckSession, refreshSession],
	);

	const value = React.useMemo(
		(): AuthContextType => ({
			...commands,
			isAuthenticated,
			isLoading,
			sessionRevalidationEnabled: revalidateSessionEnabled,
			user,
			api,
		}),
		[api, commands, isAuthenticated, isLoading, revalidateSessionEnabled, user],
	);

	return (
		<AuthContext.Provider value={value}>
			<AuthCommandsContext.Provider value={commands}>
				<AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>
			</AuthCommandsContext.Provider>
		</AuthContext.Provider>
	);
}

/** The whole auth facade — re-renders on any session change. Prefer the narrow hooks in new code. */
export function useAuth(): AuthContextType {
	const context = React.useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
}

/** The signed-in user (profile + session scope), or null — re-renders only when it changes. */
export function useAuthUser(): AuthUser | null {
	const user = React.useContext(AuthUserContext);
	if (user === undefined) {
		throw new Error("useAuthUser must be used within AuthProvider");
	}
	return user;
}

/** Whether the server confirmed a session for this tab. UI only — the API authorizes. */
export function useIsAuthenticated(): boolean {
	return authContext.useFeatureSelector(selectIsAuthenticated);
}

/** `unknown` until the first session check settles, then `authenticated` or `signed-out`. */
export function useAuthStatus(): AuthSessionState["status"] {
	return authContext.useFeatureSelector(selectAuthStatus);
}

/**
 * Whether this tab's latest session check reached a verdict: `ok`, or —
 * while the API is unreachable — `retrying` (backoff running) / `paused`
 * (budget spent; waits for back-online, tab-visible or `recheckSession`).
 * The session status itself is unchanged by a failed check. UI only.
 */
export function useSessionCheckStatus(): SessionCheckState {
	return authContext.useFeatureSelector(selectSessionCheck);
}

/**
 * True until this tab crosses a session boundary (sign-in, sign-out, another
 * member). Pass server-rendered session data as `initialData` only while it is
 * true — afterwards it describes a session that is gone, and seeding a query
 * with it (e.g. after the sign-out cache clear) would resurrect that data.
 */
export function useIsServerRenderedSession(): boolean {
	return authContext.useFeatureSelector(selectIsServerRenderedSession);
}

/** Session commands without subscribing to session state. */
export function useAuthCommands(): AuthCommands {
	const commands = React.useContext(AuthCommandsContext);
	if (commands === undefined) {
		throw new Error("useAuthCommands must be used within AuthProvider");
	}
	return commands;
}
