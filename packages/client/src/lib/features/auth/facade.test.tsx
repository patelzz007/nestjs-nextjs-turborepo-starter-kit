// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { epochMs, type ApiResponseMeta, type AuthClientType, type DataValue } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture, sessionPermissionsFixture, userFixture } from "../../../test/auth-fixtures";
import { SessionRefreshUnavailableError, type RefreshResult } from "../../api/api-request";
import { apiRouter } from "../../api/endpoints";
import { isRestrictedAuthUser } from "../../auth/session/session";
import { SESSION_CHECK_MAX_RETRIES, SESSION_CHECK_TIMEOUT_MS, sessionCheckRetryDelayMs } from "../../auth/session/session-check";
import { createAuthChannel, type AuthChannel, type AuthSyncEvent } from "../../auth/session/sync";
import {
	AuthProvider,
	useAuth,
	useAuthCommands,
	useAuthStatus,
	useAuthUser,
	useIsAuthenticated,
	useIsServerRenderedSession,
	useSessionCheckStatus,
	type AuthCommands,
	type AuthContextType,
	type AuthProviderProps,
} from "./facade";

// ── Cross-tab channel: an in-memory BroadcastChannel (jsdom has none) ──────

interface MockMessageEvent {
	readonly data: DataValue;
}

class MockBroadcastChannel {
	public static readonly channelsByName = new Map<string, MockBroadcastChannel[]>();

	public readonly name: string;
	public closed = false;
	private readonly _listeners = new Set<(message: MockMessageEvent) => void>();

	public constructor(name: string) {
		this.name = name;
		MockBroadcastChannel.channelsByName.set(name, [...(MockBroadcastChannel.channelsByName.get(name) ?? []), this]);
	}

	public postMessage(data: DataValue): void {
		for (const instance of MockBroadcastChannel.channelsByName.get(this.name) ?? []) {
			if (instance === this || instance.closed) continue;
			instance._listeners.forEach((listener) => {
				listener({ data });
			});
		}
	}

	public addEventListener(_type: "message", listener: (message: MockMessageEvent) => void): void {
		this._listeners.add(listener);
	}

	public removeEventListener(_type: "message", listener: (message: MockMessageEvent) => void): void {
		this._listeners.delete(listener);
	}

	public close(): void {
		this.closed = true;
	}
}

/** The frontend most tests render as; its cross-tab channel is `auth-sync:web`. */
const CLIENT_TYPE: AuthClientType = "web";
const CHANNEL_NAME = "auth-sync:web";

// ── The API: a routed fetch stub ──────────────────────────────────────────

type RouteName = "me" | "permissions" | "logout" | "refresh";

const ROUTE_SUFFIXES: Readonly<Record<RouteName, string>> = {
	me: "/auth/me",
	permissions: "/auth/permissions",
	logout: "/auth/logout",
	refresh: "/auth/refresh",
};

const UNAUTHORIZED_STATUS = 401;
/** Some other feature's cached query — data of the session that must not outlive it. */
const OTHER_DATA_KEY = apiRouter.geo.stats.queryKey({});
const UNAVAILABLE_STATUS = 503;
/** How long before "now" the login response was answered (latency / clock skew), so its time is distinguishable from the client's. */
const LOGIN_ANSWER_AGE_MS = 1_500;
/** Far longer than any delay the old exit used to wait before refreshing the route. */
const LONG_WAIT_AFTER_EXIT_MS = 60_000;
/** Longer than TanStack Query's first retry delay (1 s), so a retried query has answered. */
const PERMISSIONS_RETRY_WAIT_MS = 3_000;

function jsonResponse(body: DataValue, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** The meta the API stamps on an answer it gives now (fake time included). */
function answeredNow(): ApiResponseMeta {
	return { correlationId: "corr-test", timestamp: epochMs(Date.now()) };
}

function envelopeResponse(data: DataValue, meta: ApiResponseMeta = answeredNow()): Response {
	return jsonResponse(envelopeFixture(data, meta));
}

function unauthorizedResponse(): Response {
	return jsonResponse({ success: false }, UNAUTHORIZED_STATUS);
}

/** A 401 whose code says the whole session was revoked — no refresh can bring it back. */
function revokedSessionResponse(): Response {
	return jsonResponse(
		{ success: false, error: { code: "TOKEN_VERSION_MISMATCH", message: "Token revoked" }, meta: { correlationId: "corr-1", timestamp: 1790812800000 } },
		UNAUTHORIZED_STATUS,
	);
}

/** Any other failed answer (503 during a deploy, 403 from a gateway, …). */
function statusResponse(status: number): Response {
	return jsonResponse({ success: false }, status);
}

/** What each route answers; tests replace entries (a promise holds the answer back). */
let routes: Record<RouteName, () => Response | Promise<Response>>;
/** Everything that happened, in order: API calls, cross-tab posts seen by another tab, navigation. */
let timeline: string[];

function routeOf(input: string | URL | Request): RouteName | undefined {
	const pathname = new URL(input instanceof Request ? input.url : String(input)).pathname;
	const names: readonly RouteName[] = ["me", "permissions", "logout", "refresh"];
	return names.find((name: RouteName): boolean => pathname.endsWith(ROUTE_SUFFIXES[name]));
}

/** The abort signal of every `/auth/me` request, in order. */
let meSignals: AbortSignal[];

const fetchMock = vi.fn<typeof fetch>((input: string | URL | Request, init?: RequestInit): Promise<Response> => {
	const route = routeOf(input);
	if (route === undefined) {
		return Promise.resolve(jsonResponse({ success: false }, 404));
	}
	timeline.push(`api:${route}`);
	if (route === "me" && init?.signal !== undefined && init.signal !== null) {
		meSignals.push(init.signal);
	}
	return Promise.resolve(routes[route]());
});

interface HeldResponse {
	readonly promise: Promise<Response>;
	readonly release: (response: Response) => void;
}

/** An answer the test releases later — for in-flight races. */
function holdResponse(): HeldResponse {
	let release: (response: Response) => void = (): void => undefined;
	const promise = new Promise<Response>((resolve): void => {
		release = resolve;
	});
	return { promise, release };
}

/** Cached data left in the client (mounted observers may re-register empty queries after a clear). */
function cachedData(queryClient: QueryClient): readonly string[] {
	return queryClient
		.getQueryCache()
		.getAll()
		.flatMap((query): string[] => (query.state.data === undefined ? [] : [JSON.stringify(query.state.data)]));
}

/** The `X-Client-Type` header of every API request, in order (`null` when one was sent without it). */
function clientTypeHeaders(): readonly (string | null)[] {
	return fetchMock.mock.calls.map(([, init]): string | null => new Headers(init?.headers).get("X-Client-Type"));
}

function callCount(route: RouteName): number {
	return timeline.filter((entry: string): boolean => entry === `api:${route}`).length;
}

// ── Rendering ─────────────────────────────────────────────────────────────

/** The host's way out of the session's pages (the Next.js bridge navigates and refreshes). */
const leaveSession = vi.fn<(url: string) => void>((url: string): void => {
	timeline.push(`leave:${url}`);
});

interface AuthProbe {
	readonly auth: AuthContextType;
	readonly user: ReturnType<typeof useAuthUser>;
	readonly status: ReturnType<typeof useAuthStatus>;
	readonly isAuthenticated: boolean;
	readonly serverRenderedSession: boolean;
	readonly check: ReturnType<typeof useSessionCheckStatus>;
	readonly commands: AuthCommands;
}

function useAuthProbe(): AuthProbe {
	return {
		auth: useAuth(),
		user: useAuthUser(),
		status: useAuthStatus(),
		isAuthenticated: useIsAuthenticated(),
		serverRenderedSession: useIsServerRenderedSession(),
		check: useSessionCheckStatus(),
		commands: useAuthCommands(),
	};
}

type ProviderOptions = Omit<AuthProviderProps, "children">;

interface Rendered {
	readonly result: { readonly current: AuthProbe };
	readonly rerender: () => void;
	readonly unmount: () => void;
	readonly queryClient: QueryClient;
}

function renderAuth(options: ProviderOptions): Rendered {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	function wrapper({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
		return (
			<QueryClientProvider client={queryClient}>
				<AuthProvider leaveSession={leaveSession} {...options}>
					{children}
				</AuthProvider>
			</QueryClientProvider>
		);
	}
	const { result, rerender, unmount } = renderHook(useAuthProbe, { wrapper });
	return { result, rerender, unmount, queryClient };
}

/** Another tab on the same cookie set: records what it hears, can post. */
function openOtherTab(channelName: string = CHANNEL_NAME): AuthChannel {
	const channel = createAuthChannel(channelName);
	channel.subscribe((event: AuthSyncEvent): void => {
		timeline.push(`other-tab:${event}`);
	});
	return channel;
}

const GUEST: ProviderOptions = { clientType: CLIENT_TYPE, sessionHint: false };
const RETURNING_MEMBER: ProviderOptions = { clientType: CLIENT_TYPE, sessionHint: true };

beforeEach((): void => {
	timeline = [];
	meSignals = [];
	routes = {
		me: (): Response => envelopeResponse(userFixture()),
		permissions: (): Response => envelopeResponse(sessionPermissionsFixture()),
		logout: (): Response => envelopeResponse({ message: "Logged out" }),
		refresh: (): Response => envelopeResponse({ message: "Refreshed" }),
	};
	MockBroadcastChannel.channelsByName.clear();
	vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
	vi.stubGlobal("fetch", fetchMock);
	window.localStorage.clear();
	window.sessionStorage.clear();
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	fetchMock.mockClear();
	leaveSession.mockClear();
});

describe("auth facade — session check", () => {
	it("restores a session on mount: the profile from /auth/me, the scope from /auth/permissions, each fetched once", async () => {
		routes.me = (): Response => envelopeResponse(userFixture({ email: "ada@example.com", isEmailVerified: false }));
		routes.permissions = (): Response => envelopeResponse(sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "email_verification" }));

		const { result } = renderAuth(RETURNING_MEMBER);
		expect(result.current.auth.isLoading).toBe(true);

		await waitFor((): void => {
			expect(result.current.status).toBe("authenticated");
		});

		expect(result.current.auth).toMatchObject({ isLoading: false, isAuthenticated: true });
		expect(result.current.user).toMatchObject({ email: "ada@example.com", isEmailVerified: false, sessionScope: "restricted", enrollmentReason: "email_verification" });
		expect(result.current.auth.user).toBe(result.current.user);
		expect(callCount("me")).toBe(1);
		expect(callCount("permissions")).toBe(1);
	});

	it("seeds the session queries with the server's own envelopes, stamped with the time the server answered", async () => {
		const meMeta: ApiResponseMeta = { correlationId: "corr-me", timestamp: epochMs(Date.now() - LOGIN_ANSWER_AGE_MS) };
		const permissionsMeta: ApiResponseMeta = { correlationId: "corr-permissions", timestamp: epochMs(Date.now() - LOGIN_ANSWER_AGE_MS) };
		routes.me = (): Response => envelopeResponse(userFixture(), meMeta);
		routes.permissions = (): Response => envelopeResponse(sessionPermissionsFixture(), permissionsMeta);

		const { result, queryClient } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.status).toBe("authenticated");
		});

		const meKey = apiRouter.auth.me.queryKey(undefined);
		const permissionsKey = apiRouter.auth.permissions.queryKey(undefined);
		expect(meKey).toEqual(["auth", "me"]);
		expect(queryClient.getQueryData(meKey)).toEqual({ success: true, data: userFixture(), meta: meMeta });
		expect(queryClient.getQueryState(meKey)?.dataUpdatedAt).toBe(meMeta.timestamp);
		expect(queryClient.getQueryData(permissionsKey)).toEqual({ success: true, data: sessionPermissionsFixture(), meta: permissionsMeta });
		expect(queryClient.getQueryState(permissionsKey)?.dataUpdatedAt).toBe(permissionsMeta.timestamp);
	});

	it("restores a session whose /auth/permissions read failed with a PENDING scope — treated as restricted — and takes the scope from the live query once it answers", async () => {
		const permissionsAnswers: (() => Response | Promise<Response>)[] = [(): Response => statusResponse(UNAVAILABLE_STATUS)];
		const liveAnswer = holdResponse();
		routes.permissions = (): Response | Promise<Response> => (permissionsAnswers.shift() ?? ((): Promise<Response> => liveAnswer.promise))();

		const { result } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.status).toBe("authenticated");
		});

		// The check's permissions read failed: never widened to "full".
		expect(result.current.user).toMatchObject({ id: "user-1", sessionScope: "pending", enrollmentReason: null });
		expect(isRestrictedAuthUser(result.current.user)).toBe(true);
		await waitFor((): void => {
			expect(callCount("permissions")).toBe(2);
		});
		expect(result.current.user?.sessionScope).toBe("pending");

		await act(async (): Promise<void> => {
			liveAnswer.release(envelopeResponse(sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" })));
			await liveAnswer.promise;
		});

		await waitFor((): void => {
			expect(result.current.user).toMatchObject({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" });
		});
		expect(isRestrictedAuthUser(result.current.user)).toBe(true);
		expect(callCount("me")).toBe(1);
	});

	it("retries the live /auth/permissions query instead of giving up, and becomes full once it answers", async () => {
		// The check's read and the live query's first read both fail; the query's retry answers.
		const permissionsAnswers: Response[] = [statusResponse(UNAVAILABLE_STATUS), statusResponse(UNAVAILABLE_STATUS)];
		routes.permissions = (): Response => permissionsAnswers.shift() ?? envelopeResponse(sessionPermissionsFixture({ sessionScope: "full" }));

		const { result } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(callCount("permissions")).toBe(2);
		});
		expect(result.current.status).toBe("authenticated");
		expect(result.current.user?.sessionScope).toBe("pending");
		expect(isRestrictedAuthUser(result.current.user)).toBe(true);

		await waitFor(
			(): void => {
				expect(result.current.user?.sessionScope).toBe("full");
			},
			{ timeout: PERMISSIONS_RETRY_WAIT_MS },
		);
		expect(callCount("permissions")).toBe(3);
		expect(result.current.user?.enrollmentReason).toBeNull();
		expect(isRestrictedAuthUser(result.current.user)).toBe(false);
	});

	it("reads a dead session on mount as signed out after one refresh attempt — no logout, no redirect", async () => {
		routes.me = unauthorizedResponse;
		routes.permissions = unauthorizedResponse;
		routes.refresh = unauthorizedResponse;

		const { result } = renderAuth(RETURNING_MEMBER);

		await waitFor((): void => {
			expect(result.current.status).toBe("signed-out");
		});
		expect(result.current.user).toBeNull();
		expect(callCount("refresh")).toBe(1);
		expect(callCount("me")).toBe(2);
		expect(callCount("logout")).toBe(0);
		expect(leaveSession).not.toHaveBeenCalled();
	});

	it("reads a revoked session on mount as signed out without refreshing", async () => {
		routes.me = revokedSessionResponse;
		routes.permissions = revokedSessionResponse;

		const { result } = renderAuth(RETURNING_MEMBER);

		await waitFor((): void => {
			expect(result.current.status).toBe("signed-out");
		});
		expect(callCount("refresh")).toBe(0);
		expect(callCount("me")).toBe(1);
		expect(leaveSession).not.toHaveBeenCalled();
	});

	it("refreshes an expired access token once and restores the session", async () => {
		const meAnswers: Response[] = [unauthorizedResponse()];
		routes.me = (): Response => meAnswers.shift() ?? envelopeResponse(userFixture());

		const { result } = renderAuth(RETURNING_MEMBER);

		await waitFor((): void => {
			expect(result.current.status).toBe("authenticated");
		});
		expect(callCount("refresh")).toBe(1);
		expect(callCount("me")).toBe(2);
		expect(leaveSession).not.toHaveBeenCalled();
	});

	it("makes no session request for a guest and settles signed out", () => {
		const { result } = renderAuth(GUEST);

		expect(result.current.status).toBe("signed-out");
		expect(result.current.auth).toMatchObject({ isLoading: false, isAuthenticated: false, user: null });
		expect(timeline).toEqual([]);
	});

	it("never writes session state to browser storage", async () => {
		const { result } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});

		expect(window.localStorage.length).toBe(0);
		expect(window.sessionStorage.length).toBe(0);
	});
});

describe("auth facade — sign-in", () => {
	it("establishes the session from the login response without re-fetching the profile, tells the other tabs, and reads the scope from /auth/permissions", async () => {
		routes.permissions = (): Response => envelopeResponse(sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "mfa_enrollment" }));
		const { result } = renderAuth(GUEST);
		openOtherTab();

		act((): void => {
			result.current.commands.login(userFixture({ fullName: "Grace Member" }), answeredNow());
		});

		// The login response says nothing about the scope: it is pending — restricted — until /auth/permissions answers.
		expect(result.current.user).toMatchObject({ fullName: "Grace Member", sessionScope: "pending", enrollmentReason: null });
		expect(isRestrictedAuthUser(result.current.user)).toBe(true);
		expect(timeline).toContain("other-tab:logged-in");
		await waitFor((): void => {
			expect(result.current.user).toMatchObject({ fullName: "Grace Member", sessionScope: "restricted", enrollmentReason: "mfa_enrollment" });
		});
		expect(callCount("permissions")).toBe(1);
		expect(callCount("me")).toBe(0);
	});

	it("never assumes a full session at sign-in: pending until /auth/permissions answers full", async () => {
		const permissionsAnswer = holdResponse();
		routes.permissions = (): Promise<Response> => permissionsAnswer.promise;
		const { result } = renderAuth(GUEST);

		act((): void => {
			result.current.commands.login(userFixture({ isEmailVerified: false }), answeredNow());
		});
		await waitFor((): void => {
			expect(callCount("permissions")).toBe(1);
		});
		expect(result.current.user?.sessionScope).toBe("pending");
		expect(isRestrictedAuthUser(result.current.user)).toBe(true);

		await act(async (): Promise<void> => {
			permissionsAnswer.release(envelopeResponse(sessionPermissionsFixture({ sessionScope: "full" })));
			await permissionsAnswer.promise;
		});

		await waitFor((): void => {
			expect(result.current.user?.sessionScope).toBe("full");
		});
		expect(result.current.user?.enrollmentReason).toBeNull();
		expect(isRestrictedAuthUser(result.current.user)).toBe(false);
	});

	it("seeds /auth/me with the login response's own meta, stamped with the time the server answered", () => {
		const { result, queryClient } = renderAuth(GUEST);
		const answeredBy: ApiResponseMeta = { correlationId: "corr-login", timestamp: epochMs(Date.now() - LOGIN_ANSWER_AGE_MS) };
		const profile = userFixture({ fullName: "Grace Member" });

		act((): void => {
			result.current.commands.login(profile, answeredBy);
		});

		expect(queryClient.getQueryData(apiRouter.auth.me.queryKey(undefined))).toEqual({ success: true, data: profile, meta: answeredBy });
		expect(queryClient.getQueryState(apiRouter.auth.me.queryKey(undefined))?.dataUpdatedAt).toBe(answeredBy.timestamp);
	});

	it("re-reads the scope when the same member signs in again after verifying their email — restricted, then full", async () => {
		routes.permissions = (): Response => envelopeResponse(sessionPermissionsFixture({ sessionScope: "restricted", enrollmentReason: "email_verification" }));
		const { result } = renderAuth(GUEST);
		act((): void => {
			result.current.commands.login(userFixture({ isEmailVerified: false }), answeredNow());
		});
		await waitFor((): void => {
			expect(result.current.user).toMatchObject({ isEmailVerified: false, sessionScope: "restricted", enrollmentReason: "email_verification" });
		});
		routes.permissions = (): Response => envelopeResponse(sessionPermissionsFixture({ sessionScope: "full" }));

		act((): void => {
			result.current.commands.login(userFixture({ isEmailVerified: true }), answeredNow());
		});

		// The previous session's restricted answer is dropped, never carried over.
		expect(result.current.user).toMatchObject({ isEmailVerified: true, sessionScope: "pending", enrollmentReason: null });
		await waitFor((): void => {
			expect(result.current.user).toMatchObject({ isEmailVerified: true, sessionScope: "full", enrollmentReason: null });
		});
		expect(callCount("permissions")).toBe(2);
		expect(callCount("me")).toBe(0);
	});
});

describe("auth facade — sign-out", () => {
	it("clears the session and cache before the server session, then tells the other tabs, then leaves", async () => {
		const { result, queryClient } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});
		openOtherTab();
		let cachedProfileAtLogout: object | undefined;
		routes.logout = (): Response => {
			cachedProfileAtLogout = queryClient.getQueryData<object>(apiRouter.auth.me.queryKey(undefined));
			return envelopeResponse({ message: "Logged out" });
		};
		timeline = [];

		await act(async (): Promise<void> => {
			await result.current.commands.logout();
		});

		expect(result.current.status).toBe("signed-out");
		expect(result.current.user).toBeNull();
		expect(cachedProfileAtLogout).toBeUndefined();
		expect(cachedData(queryClient)).toEqual([]);
		expect(timeline).toEqual(["api:logout", "other-tab:logged-out", "leave:/auth/login"]);
		expect(leaveSession).toHaveBeenCalledTimes(1);
	});

	it("leaves the session's pages exactly once, as soon as the server session is cleared — no timer involved", async () => {
		vi.useFakeTimers();
		try {
			const { result } = renderAuth(GUEST);
			act((): void => {
				result.current.commands.login(userFixture(), answeredNow());
			});

			await act(async (): Promise<void> => {
				await result.current.commands.logout();
			});

			// No fake time has passed: the exit did not wait for a timer.
			expect(leaveSession).toHaveBeenCalledTimes(1);
			expect(leaveSession).toHaveBeenCalledWith("/auth/login");

			await act(async (): Promise<void> => {
				await vi.advanceTimersByTimeAsync(LONG_WAIT_AFTER_EXIT_MS);
			});
			expect(leaveSession).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("leaves for the configured redirect target", async () => {
		const { result } = renderAuth({ ...GUEST, onUnauthorizedRedirect: "/merchant/sign-in" });
		act((): void => {
			result.current.commands.login(userFixture(), answeredNow());
		});

		await act(async (): Promise<void> => {
			await result.current.commands.logout();
		});

		expect(leaveSession).toHaveBeenCalledTimes(1);
		expect(leaveSession).toHaveBeenCalledWith("/merchant/sign-in");
	});

	it("drops the session and its cache at once when another tab signs out — before its own logout call returns — then redirects", async () => {
		const { result, queryClient } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});
		const otherTab = openOtherTab();
		const logoutAnswer = holdResponse();
		routes.logout = (): Promise<Response> => logoutAnswer.promise;

		act((): void => {
			otherTab.post("logged-out");
		});

		// The logout POST is still pending: the previous session is already gone.
		expect(callCount("logout")).toBe(1);
		expect(result.current.status).toBe("signed-out");
		expect(result.current.user).toBeNull();
		expect(cachedData(queryClient)).toEqual([]);
		expect(leaveSession).not.toHaveBeenCalled();

		await act(async (): Promise<void> => {
			logoutAnswer.release(envelopeResponse({ message: "Logged out" }));
			await logoutAnswer.promise;
		});
		await waitFor((): void => {
			expect(leaveSession).toHaveBeenCalledTimes(1);
		});
		expect(leaveSession).toHaveBeenCalledWith("/auth/login");
	});

	it("ignores a repeated sign-out message", async () => {
		const { result } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});
		const otherTab = openOtherTab();

		act((): void => {
			otherTab.post("logged-out");
			otherTab.post("logged-out");
		});

		await waitFor((): void => {
			expect(leaveSession).toHaveBeenCalledTimes(1);
		});
		expect(callCount("logout")).toBe(1);
	});

	it("clears the previous member's cached data when another tab signs in as someone else", async () => {
		routes.me = (): Response => envelopeResponse(userFixture({ id: "member-x", email: "x@example.com" }));
		const { result, queryClient } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.user?.id).toBe("member-x");
		});
		queryClient.setQueryData(OTHER_DATA_KEY, { owner: "member-x" });
		routes.me = (): Response => envelopeResponse(userFixture({ id: "member-y", email: "y@example.com" }));
		const otherTab = openOtherTab();

		act((): void => {
			otherTab.post("logged-in");
		});

		await waitFor((): void => {
			expect(result.current.user?.id).toBe("member-y");
		});
		expect(queryClient.getQueryData(OTHER_DATA_KEY)).toBeUndefined();
		expect(cachedData(queryClient).join()).not.toContain("x@example.com");
	});

	it("clears the cache, without redirecting, when a re-check no longer finds the session", async () => {
		const { result, queryClient } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});
		queryClient.setQueryData(OTHER_DATA_KEY, { rows: 3 });
		routes.me = unauthorizedResponse;
		const otherTab = openOtherTab();

		act((): void => {
			otherTab.post("logged-in");
		});

		await waitFor((): void => {
			expect(result.current.status).toBe("signed-out");
		});
		expect(cachedData(queryClient)).toEqual([]);
		expect(leaveSession).not.toHaveBeenCalled();
	});

	it("drops a session check that answers after the member signed out — a late 200 never restores the session", async () => {
		const meAnswer = holdResponse();
		routes.me = (): Promise<Response> => meAnswer.promise;
		const { result, queryClient } = renderAuth(RETURNING_MEMBER);
		expect(result.current.status).toBe("unknown");

		await act(async (): Promise<void> => {
			await result.current.commands.logout();
		});
		await act(async (): Promise<void> => {
			meAnswer.release(envelopeResponse(userFixture()));
			await meAnswer.promise;
		});

		expect(result.current.status).toBe("signed-out");
		expect(result.current.user).toBeNull();
		expect(cachedData(queryClient)).toEqual([]);
	});

	it("re-checks the session when another tab signs in", async () => {
		const { result } = renderAuth(GUEST);
		const otherTab = openOtherTab();

		act((): void => {
			otherTab.post("logged-in");
		});

		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});
		expect(callCount("me")).toBe(1);
	});
});

describe("auth facade — 401 pipeline", () => {
	it("expires the session once for concurrent 401s — one refresh, one logout, one broadcast, one redirect — and never again", async () => {
		const { result } = renderAuth(GUEST);
		act((): void => {
			result.current.commands.login(userFixture(), answeredNow());
		});
		openOtherTab();
		routes.me = unauthorizedResponse;
		routes.refresh = unauthorizedResponse;

		await act(async (): Promise<void> => {
			await Promise.all([
				result.current.auth.api.auth.me.fetch(undefined),
				result.current.auth.api.auth.me.fetch(undefined),
				result.current.auth.api.auth.me.fetch(undefined),
			]);
		});

		expect(result.current.status).toBe("signed-out");
		expect(callCount("refresh")).toBe(1);
		expect(callCount("logout")).toBe(1);
		expect(timeline.filter((entry: string): boolean => entry === "other-tab:logged-out")).toHaveLength(1);
		expect(leaveSession).toHaveBeenCalledTimes(1);
		expect(leaveSession).toHaveBeenCalledWith("/auth/login");

		await act(async (): Promise<void> => {
			await result.current.auth.api.auth.me.fetch(undefined);
		});
		expect(callCount("refresh")).toBe(1);
		expect(callCount("logout")).toBe(1);
		expect(leaveSession).toHaveBeenCalledTimes(1);
	});

	it("shares ONE in-flight refresh between refreshSession() callers and a 401-triggered refresh — exactly one POST /auth/refresh", async () => {
		const { result } = renderAuth(GUEST);
		act((): void => {
			result.current.commands.login(userFixture(), answeredNow());
		});
		const refreshAnswer = holdResponse();
		routes.refresh = (): Promise<Response> => refreshAnswer.promise;
		const meAnswers: Response[] = [unauthorizedResponse()];
		routes.me = (): Response => meAnswers.shift() ?? envelopeResponse(userFixture());

		let request: ReturnType<typeof result.current.auth.api.auth.me.fetch> | undefined;
		act((): void => {
			request = result.current.auth.api.auth.me.fetch(undefined);
		});
		// The 401 started the silent refresh, which is now in flight.
		await waitFor((): void => {
			expect(callCount("refresh")).toBe(1);
		});

		let refreshed: Promise<readonly RefreshResult[]> | undefined;
		act((): void => {
			refreshed = Promise.all([result.current.commands.refreshSession(), result.current.commands.refreshSession()]);
		});
		await act(async (): Promise<void> => {
			refreshAnswer.release(envelopeResponse({ message: "Refreshed" }));
			await refreshAnswer.promise;
		});

		await expect(refreshed).resolves.toEqual(["ok", "ok"]);
		const retried = await request;
		expect(retried?.ok).toBe(true);
		expect(callCount("refresh")).toBe(1);
		expect(result.current.status).toBe("authenticated");
	});

	it("starts a refresh from refreshSession() that a later 401 joins instead of rotating the token again", async () => {
		const { result } = renderAuth(GUEST);
		act((): void => {
			result.current.commands.login(userFixture(), answeredNow());
		});
		const refreshAnswer = holdResponse();
		routes.refresh = (): Promise<Response> => refreshAnswer.promise;
		const meAnswer = holdResponse();
		routes.me = (): Promise<Response> => meAnswer.promise;

		let refreshed: Promise<RefreshResult> | undefined;
		act((): void => {
			refreshed = result.current.commands.refreshSession();
		});
		await waitFor((): void => {
			expect(callCount("refresh")).toBe(1);
		});
		let request: ReturnType<typeof result.current.auth.api.auth.me.fetch> | undefined;
		act((): void => {
			request = result.current.auth.api.auth.me.fetch(undefined);
		});
		await waitFor((): void => {
			expect(callCount("me")).toBe(1);
		});
		routes.me = (): Response => envelopeResponse(userFixture());
		// The 401 arrives while the refresh is still in flight, and joins it.
		await act(async (): Promise<void> => {
			meAnswer.release(unauthorizedResponse());
			await meAnswer.promise;
		});
		expect(callCount("refresh")).toBe(1);

		await act(async (): Promise<void> => {
			refreshAnswer.release(envelopeResponse({ message: "Refreshed" }));
			await refreshAnswer.promise;
		});

		await expect(refreshed).resolves.toBe("ok");
		expect((await request)?.ok).toBe(true);
		expect(callCount("refresh")).toBe(1);
	});

	it("reports an expired session from refreshSession() without calling the API once the tab signed out", async () => {
		const { result } = renderAuth(GUEST);
		act((): void => {
			result.current.commands.login(userFixture(), answeredNow());
		});
		await act(async (): Promise<void> => {
			await result.current.commands.logout();
		});

		await expect(result.current.commands.refreshSession()).resolves.toBe("expired");
		expect(callCount("refresh")).toBe(0);
	});

	it("keeps the session when a 401's refresh cannot reach the API — only the request fails", async () => {
		const { result } = renderAuth(GUEST);
		act((): void => {
			result.current.commands.login(userFixture(), answeredNow());
		});
		openOtherTab();
		routes.me = unauthorizedResponse;
		routes.refresh = (): Response => statusResponse(503);

		let first: Awaited<ReturnType<typeof result.current.auth.api.auth.me.fetch>> | undefined;
		await act(async (): Promise<void> => {
			first = await result.current.auth.api.auth.me.fetch(undefined);
		});

		expect(first?.ok).toBe(false);
		if (first !== undefined && !first.ok) {
			expect(first.error).toBeInstanceOf(SessionRefreshUnavailableError);
		}
		expect(result.current.status).toBe("authenticated");
		expect(callCount("refresh")).toBe(1);
		expect(callCount("logout")).toBe(0);
		expect(timeline).not.toContain("other-tab:logged-out");
		expect(leaveSession).not.toHaveBeenCalled();

		// Inside the cooldown the next 401 does not re-hit the refresh — and still keeps the session.
		await act(async (): Promise<void> => {
			await result.current.auth.api.auth.me.fetch(undefined);
		});
		expect(callCount("refresh")).toBe(1);
		expect(callCount("logout")).toBe(0);
		expect(result.current.status).toBe("authenticated");
	});

	it("stays on a guest-browsable page and leaves the other tabs alone", async () => {
		const { result } = renderAuth({ ...GUEST, shouldRedirectOnUnauthorized: (): boolean => false });
		act((): void => {
			result.current.commands.login(userFixture(), answeredNow());
		});
		openOtherTab();
		routes.me = unauthorizedResponse;
		routes.refresh = unauthorizedResponse;

		await act(async (): Promise<void> => {
			await result.current.auth.api.auth.me.fetch(undefined);
		});

		expect(result.current.status).toBe("signed-out");
		expect(callCount("logout")).toBe(1);
		expect(leaveSession).not.toHaveBeenCalled();
		expect(timeline).not.toContain("other-tab:logged-out");
	});
});

describe("auth facade — provider", () => {
	it("keeps command identities stable across renders", () => {
		const { result, rerender } = renderAuth(GUEST);
		const first = result.current.commands;

		rerender();

		expect(result.current.commands).toBe(first);
		expect(result.current.auth.logout).toBe(first.logout);
	});

	it("gives each provider mount its own session", async () => {
		// Separate frontends (cookie sets), so the sign-in broadcast cannot reach the second mount.
		const first = renderAuth({ ...GUEST, clientType: "web" });
		const second = renderAuth({ ...GUEST, clientType: "admin" });

		act((): void => {
			first.result.current.commands.login(userFixture(), answeredNow());
		});
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});

		expect(first.result.current.isAuthenticated).toBe(true);
		expect(second.result.current.isAuthenticated).toBe(false);
		expect(callCount("me")).toBe(0);
	});

	it("names the cross-tab channel after the frontend — auth-sync:<clientType> — and hears only that channel", async () => {
		const { result } = renderAuth({ ...RETURNING_MEMBER, clientType: "merchant" });
		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});
		expect([...MockBroadcastChannel.channelsByName.keys()]).toEqual(["auth-sync:merchant"]);

		const webTab = openOtherTab("auth-sync:web");
		act((): void => {
			webTab.post("logged-out");
		});
		expect(result.current.status).toBe("authenticated");

		const merchantTab = openOtherTab("auth-sync:merchant");
		act((): void => {
			merchantTab.post("logged-out");
		});
		expect(result.current.status).toBe("signed-out");
	});

	it("sends X-Client-Type for its frontend on every request — session check, refresh, logout and typed calls", async () => {
		const meAnswers: Response[] = [unauthorizedResponse()];
		routes.me = (): Response => meAnswers.shift() ?? envelopeResponse(userFixture());
		const { result } = renderAuth({ ...RETURNING_MEMBER, clientType: "admin" });
		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});
		await act(async (): Promise<void> => {
			await result.current.auth.api.auth.permissions.fetch(undefined);
			await result.current.commands.refreshSession();
			await result.current.commands.logout();
		});

		expect(callCount("me")).toBeGreaterThanOrEqual(1);
		expect(callCount("permissions")).toBeGreaterThanOrEqual(1);
		expect(callCount("refresh")).toBe(2);
		expect(callCount("logout")).toBe(1);
		expect(clientTypeHeaders()).toHaveLength(fetchMock.mock.calls.length);
		expect(new Set(clientTypeHeaders())).toEqual(new Set(["admin"]));
	});

	it("sends X-Client-Type: web for the web frontend too — the API never has to guess", async () => {
		const { result } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});

		expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
		expect(new Set(clientTypeHeaders())).toEqual(new Set(["web"]));
	});

	it("leaves the server-rendered epoch at the first session boundary", async () => {
		const { result } = renderAuth(RETURNING_MEMBER);
		await waitFor((): void => {
			expect(result.current.isAuthenticated).toBe(true);
		});
		expect(result.current.serverRenderedSession).toBe(true);

		await act(async (): Promise<void> => {
			await result.current.commands.logout();
		});

		expect(result.current.serverRenderedSession).toBe(false);
	});

	it("fails loudly outside its provider", () => {
		expect(() => renderHook(useAuth)).toThrow(/useAuth must be used within AuthProvider/u);
		expect(() => renderHook(useAuthUser)).toThrow(/useAuthUser must be used within AuthProvider/u);
		expect(() => renderHook(useAuthCommands)).toThrow(/useAuthCommands must be used within AuthProvider/u);
		expect(() => renderHook(useIsAuthenticated)).toThrow(/Auth store is missing/u);
	});
});

describe("auth facade — the API is unreachable", () => {
	/** `Math.random` pinned low: every retry waits exactly half its backoff step, every trigger re-checks at once. */
	const LOWEST_RANDOM = 0;
	const RETRY_DELAYS_MS: readonly number[] = Array.from(Array(SESSION_CHECK_MAX_RETRIES).keys(), (index: number): number =>
		sessionCheckRetryDelayMs(index + 1, (): number => LOWEST_RANDOM),
	);
	const FIRST_RETRY_MS = RETRY_DELAYS_MS[0] ?? 0;
	/** Longer than the whole retry series. */
	const LONG_WAIT_MS = 10 * 60_000;
	const UNAVAILABLE_STATUS = 503;

	let visibility: DocumentVisibilityState;
	let online: boolean;

	function serviceUnavailable(): Response {
		return statusResponse(UNAVAILABLE_STATUS);
	}

	/** Lets fake time pass, flushing React updates and promise chains. */
	async function settle(ms = 0): Promise<void> {
		await act(async (): Promise<void> => {
			await vi.advanceTimersByTimeAsync(ms);
		});
	}

	/** Mounts a returning member, waits for the first check, and requires it to have signed in. */
	async function signedInTab(): Promise<Rendered> {
		const rendered = renderAuth(RETURNING_MEMBER);
		await settle();
		expect(rendered.result.current.status).toBe("authenticated");
		return rendered;
	}

	/** Runs the whole retry series against a down API. */
	async function exhaustRetries(): Promise<void> {
		for (const delay of RETRY_DELAYS_MS) {
			await settle(delay);
		}
	}

	beforeEach((): void => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(LOWEST_RANDOM);
		visibility = "visible";
		online = true;
		Object.defineProperty(document, "visibilityState", { configurable: true, get: (): DocumentVisibilityState => visibility });
		Object.defineProperty(navigator, "onLine", { configurable: true, get: (): boolean => online });
	});

	afterEach((): void => {
		Reflect.deleteProperty(document, "visibilityState");
		Reflect.deleteProperty(navigator, "onLine");
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("keeps an authenticated tab — and its cached data — through a 503 re-check, without signing out or redirecting", async () => {
		const { result, queryClient } = await signedInTab();
		queryClient.setQueryData(OTHER_DATA_KEY, { rows: 3 });
		routes.me = serviceUnavailable;
		const otherTab = openOtherTab();

		act((): void => {
			otherTab.post("logged-in");
		});
		await settle();

		expect(result.current.status).toBe("authenticated");
		expect(result.current.user?.id).toBe("user-1");
		expect(queryClient.getQueryData(OTHER_DATA_KEY)).toEqual({ rows: 3 });
		expect(result.current.check).toEqual({ status: "retrying", reason: "server-error", failedAttempts: 1 });
		expect(callCount("refresh")).toBe(0);
		expect(callCount("logout")).toBe(0);
		expect(leaveSession).not.toHaveBeenCalled();
	});

	it("keeps an unknown tab unknown — never signed out — reports the failure instead of checking forever, and restores it once the API is back", async () => {
		routes.me = serviceUnavailable;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();

		expect(result.current.status).toBe("unknown");
		expect(result.current.auth.isAuthenticated).toBe(false);
		expect(result.current.check).toEqual({ status: "retrying", reason: "server-error", failedAttempts: 1 });

		routes.me = (): Response => envelopeResponse(userFixture());
		await settle(FIRST_RETRY_MS);

		expect(result.current.status).toBe("authenticated");
		expect(result.current.check).toEqual({ status: "ok" });
		expect(callCount("me")).toBe(2);
	});

	it("stops waiting for a hung API after the timeout", async () => {
		routes.me = (): Promise<Response> => holdResponse().promise;
		const { result } = renderAuth(RETURNING_MEMBER);

		await settle(SESSION_CHECK_TIMEOUT_MS);

		expect(result.current.status).toBe("unknown");
		expect(result.current.check).toEqual({ status: "retrying", reason: "timeout", failedAttempts: 1 });
	});

	it("retries with capped exponential backoff, then pauses — and sends nothing more once the budget is spent", async () => {
		routes.me = serviceUnavailable;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();
		expect(callCount("me")).toBe(1);

		for (const [index, delay] of RETRY_DELAYS_MS.entries()) {
			await settle(delay - 1);
			expect(callCount("me")).toBe(index + 1);
			await settle(1);
			expect(callCount("me")).toBe(index + 2);
		}

		expect(result.current.check).toEqual({ status: "paused", reason: "server-error", failedAttempts: SESSION_CHECK_MAX_RETRIES + 1 });
		await settle(LONG_WAIT_MS);
		expect(callCount("me")).toBe(SESSION_CHECK_MAX_RETRIES + 1);
		expect(result.current.status).toBe("unknown");
	});

	it("stops retrying when the member signs out", async () => {
		routes.me = serviceUnavailable;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();

		await act(async (): Promise<void> => {
			await result.current.commands.logout();
		});
		await settle(LONG_WAIT_MS);

		expect(callCount("me")).toBe(1);
		expect(result.current.status).toBe("signed-out");
		expect(result.current.check).toEqual({ status: "ok" });
	});

	it("stops retrying at a session boundary (a sign-in in this tab)", async () => {
		routes.me = serviceUnavailable;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();

		act((): void => {
			result.current.commands.login(userFixture(), answeredNow());
		});
		await settle(RETRY_DELAYS_MS.reduce((total: number, delay: number): number => total + delay, 0));

		expect(callCount("me")).toBe(1);
		expect(result.current.status).toBe("authenticated");
		expect(result.current.check).toEqual({ status: "ok" });
	});

	it("stops retrying on unmount", async () => {
		routes.me = serviceUnavailable;
		const { unmount } = renderAuth(RETURNING_MEMBER);
		await settle();

		unmount();
		await settle(LONG_WAIT_MS);

		expect(callCount("me")).toBe(1);
	});

	it("starts a fresh series after a verdict", async () => {
		routes.me = serviceUnavailable;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();
		await settle(RETRY_DELAYS_MS[0]);
		expect(result.current.check).toEqual({ status: "retrying", reason: "server-error", failedAttempts: 2 });

		routes.me = (): Response => envelopeResponse(userFixture());
		await settle(RETRY_DELAYS_MS[1]);
		expect(result.current.check).toEqual({ status: "ok" });

		routes.me = serviceUnavailable;
		const otherTab = openOtherTab();
		act((): void => {
			otherTab.post("logged-in");
		});
		await settle();
		expect(result.current.check).toEqual({ status: "retrying", reason: "server-error", failedAttempts: 1 });
	});

	it("still signs out on a revoked session: cache cleared, no refresh, no redirect", async () => {
		const { result, queryClient } = await signedInTab();
		queryClient.setQueryData(OTHER_DATA_KEY, { rows: 3 });
		routes.me = revokedSessionResponse;
		const otherTab = openOtherTab();

		act((): void => {
			otherTab.post("logged-in");
		});
		await settle();

		expect(result.current.status).toBe("signed-out");
		expect(cachedData(queryClient)).toEqual([]);
		expect(callCount("refresh")).toBe(0);
		expect(callCount("logout")).toBe(0);
		expect(leaveSession).not.toHaveBeenCalled();
	});

	it("keeps the session when the refresh an expired access token needs cannot reach the API", async () => {
		const { result, queryClient } = await signedInTab();
		queryClient.setQueryData(OTHER_DATA_KEY, { rows: 3 });
		routes.me = unauthorizedResponse;
		routes.refresh = serviceUnavailable;
		const otherTab = openOtherTab();

		act((): void => {
			otherTab.post("logged-in");
		});
		await settle();

		expect(result.current.status).toBe("authenticated");
		expect(result.current.check).toEqual({ status: "retrying", reason: "refresh-unavailable", failedAttempts: 1 });
		expect(queryClient.getQueryData(OTHER_DATA_KEY)).toEqual({ rows: 3 });
		expect(callCount("refresh")).toBe(1);
		expect(callCount("logout")).toBe(0);
		expect(leaveSession).not.toHaveBeenCalled();
	});

	it("reports a malformed /auth/me answer and never treats it as signed in", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation((): void => undefined);
		routes.me = (): Response => envelopeResponse({ id: 42 });
		const { result } = renderAuth(RETURNING_MEMBER);

		await settle();

		expect(result.current.status).toBe("unknown");
		expect(result.current.user).toBeNull();
		expect(result.current.check).toEqual({ status: "retrying", reason: "contract-violation", failedAttempts: 1 });
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("session check"), expect.objectContaining({ kind: "contract-violation", endpoint: "me", status: 200 }));
	});

	it("reports a 403 and keeps an authenticated tab authenticated", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation((): void => undefined);
		const { result } = await signedInTab();
		routes.me = (): Response => statusResponse(403);
		const otherTab = openOtherTab();

		act((): void => {
			otherTab.post("logged-in");
		});
		await settle();

		expect(result.current.status).toBe("authenticated");
		expect(result.current.check).toEqual({ status: "retrying", reason: "unexpected-status", failedAttempts: 1 });
		expect(callCount("refresh")).toBe(0);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("session check"), expect.objectContaining({ kind: "unexpected-status", endpoint: "me", status: 403 }));
	});

	it("does not retry while the tab is hidden, and re-checks with a fresh budget once it is visible", async () => {
		visibility = "hidden";
		routes.me = serviceUnavailable;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();
		await settle(LONG_WAIT_MS);
		expect(callCount("me")).toBe(1);

		visibility = "visible";
		routes.me = (): Response => envelopeResponse(userFixture());
		act((): void => {
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await settle();

		expect(callCount("me")).toBe(2);
		expect(result.current.status).toBe("authenticated");
	});

	it("does not retry while the browser is offline, and re-checks when it is back online", async () => {
		online = false;
		routes.me = serviceUnavailable;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();
		await settle(LONG_WAIT_MS);
		expect(callCount("me")).toBe(1);

		online = true;
		act((): void => {
			window.dispatchEvent(new Event("online"));
		});
		await settle();

		expect(callCount("me")).toBe(2);
		expect(result.current.check).toEqual({ status: "retrying", reason: "server-error", failedAttempts: 1 });
	});

	it("re-checks a paused tab when the browser comes back online, with a fresh budget", async () => {
		routes.me = serviceUnavailable;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();
		await exhaustRetries();
		expect(result.current.check.status).toBe("paused");

		routes.me = (): Response => envelopeResponse(userFixture());
		act((): void => {
			window.dispatchEvent(new Event("online"));
		});
		await settle();

		expect(result.current.status).toBe("authenticated");
		expect(result.current.check).toEqual({ status: "ok" });
	});

	it("never re-checks a healthy tab on visibility or connectivity events", async () => {
		await signedInTab();

		act((): void => {
			window.dispatchEvent(new Event("online"));
			document.dispatchEvent(new Event("visibilitychange"));
		});
		await settle(LONG_WAIT_MS);

		expect(callCount("me")).toBe(1);
	});

	it('re-checks at once when the member asks ("Try again")', async () => {
		routes.me = serviceUnavailable;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();
		await exhaustRetries();
		const checksBefore = callCount("me");

		act((): void => {
			result.current.commands.recheckSession();
		});
		await settle();

		expect(callCount("me")).toBe(checksBefore + 1);
		expect(result.current.check).toEqual({ status: "retrying", reason: "server-error", failedAttempts: 1 });
	});

	it("aborts the check in flight at a session boundary (sign-out) and on unmount", async () => {
		routes.me = (): Promise<Response> => holdResponse().promise;
		const first = renderAuth(RETURNING_MEMBER);
		await settle();
		expect(meSignals.map((signal: AbortSignal): boolean => signal.aborted)).toEqual([false]);

		await act(async (): Promise<void> => {
			await first.result.current.commands.logout();
		});
		expect(meSignals.map((signal: AbortSignal): boolean => signal.aborted)).toEqual([true]);

		const second = renderAuth(RETURNING_MEMBER);
		await settle();
		second.unmount();
		expect(meSignals.map((signal: AbortSignal): boolean => signal.aborted)).toEqual([true, true]);
	});

	it("lets only the newest check apply — a newer one aborts the one in flight", async () => {
		const held = holdResponse();
		routes.me = (): Promise<Response> => held.promise;
		const { result } = renderAuth(RETURNING_MEMBER);
		await settle();
		routes.me = (): Response => envelopeResponse(userFixture({ id: "member-new" }));
		const otherTab = openOtherTab();

		act((): void => {
			otherTab.post("logged-in");
		});
		await settle();
		await act(async (): Promise<void> => {
			held.release(serviceUnavailable());
			await held.promise;
		});
		await settle();

		expect(meSignals.map((signal: AbortSignal): boolean => signal.aborted)).toEqual([true, false]);
		expect(result.current.user?.id).toBe("member-new");
		expect(result.current.check).toEqual({ status: "ok" });
	});

	it("never broadcasts a failed check to the other tabs", async () => {
		await signedInTab();
		routes.me = serviceUnavailable;
		const otherTab = openOtherTab();
		timeline = [];

		act((): void => {
			otherTab.post("logged-in");
		});
		await settle(LONG_WAIT_MS);

		expect(timeline.filter((entry: string): boolean => entry.startsWith("other-tab:"))).toEqual([]);
	});
});
