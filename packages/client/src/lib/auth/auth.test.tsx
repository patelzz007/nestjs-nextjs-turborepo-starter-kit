// @vitest-environment jsdom
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ReactNode } from "react";

import { AuthProvider, useAuth, type CookieNamesConfig } from "./index";
import type { AuthUser } from "./auth-store";

const MOCK_USER: AuthUser = {
	id: "user-1",
	email: "test@example.com",
	fullName: "Test User",
	isSuperAdmin: false,
	hasAdminAccess: true,
	isEmailVerified: true,
	roles: [{ id: "role-1", name: "admin" }],
};
import { QueryProvider } from "../api/query-provider";
import { fetchCalls, headersOf, inputUrl, jsonResponse, type FetchCall, type FetchImpl } from "../test-utils";

/**
 * Minimal BroadcastChannel mock so cross-tab sync can be exercised under jsdom
 * (jsdom has no BroadcastChannel). Instances register in a static registry;
 * `postMessage` delivers to sibling instances of the same name only — never to
 * the sender, mirroring the real API's cross-context semantics.
 */
interface MockMessageEvent {
	readonly data: unknown;
}

class MockBroadcastChannel {
	public static readonly instances: MockBroadcastChannel[] = [];

	public closed = false;
	private readonly _listeners = new Set<(message: MockMessageEvent) => void>();

	public constructor(public readonly name: string) {
		MockBroadcastChannel.instances.push(this);
	}

	public postMessage(data: unknown): void {
		for (const instance of MockBroadcastChannel.instances) {
			if (instance === this || instance.name !== this.name || instance.closed) continue;
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

/**
 * Simulate a second browser tab: open a *separate* channel on the same name as
 * the provider's (the mock's postMessage skips the sender, so posting from the
 * provider's own channel would never deliver). Returns nothing — the post is
 * delivered synchronously to the provider's subscribed channel.
 */
function postFromOtherTab(data: unknown): void {
	const channelName = MockBroadcastChannel.instances[0]?.name;
	if (channelName === undefined) throw new Error("no BroadcastChannel instance created");
	const otherTab = new MockBroadcastChannel(channelName);
	otherTab.postMessage(data);
	otherTab.close();
}

const BASE_URL = "http://api.test";

type NavigateFn = (url: string) => void;
type RefreshFn = () => void;

const USER_FIXTURE = {
	id: "u_1",
	email: "alex@example.com",
	fullName: "Alex Morgan",
	isActive: true,
	isSuperAdmin: false,
	isEmailVerified: true,
	hasAdminAccess: false,
	tokenVersion: 0,
	roles: [],
	createdAt: 1786428000000,
	updatedAt: 1786428000000,
	isDeleted: false,
	deletedAt: null,
};

const ME_BODY = { success: true, data: USER_FIXTURE, meta: { timestamp: 1786428000000 } };

const REFRESH_BODY = {
	success: true,
	data: { accessToken: "new-access-token", refreshToken: "new-refresh-token" },
	meta: { timestamp: 1786428000000 },
};

function refreshCalls(mock: Mock<FetchImpl>): FetchCall[] {
	return fetchCalls(mock).filter((call) => inputUrl(call.input).endsWith("/auth/refresh"));
}

let navigate: ReturnType<typeof vi.fn<NavigateFn>>;
let refresh: ReturnType<typeof vi.fn<RefreshFn>>;

function wrapper({ children }: { children: ReactNode }): ReactNode {
	return (
		<QueryProvider>
			<AuthProvider baseUrl={BASE_URL} navigate={navigate} refresh={refresh}>
				{children}
			</AuthProvider>
		</QueryProvider>
	);
}

function adminWrapper({ children }: { children: ReactNode }): ReactNode {
	const cookieNames: CookieNamesConfig = { accessToken: "adminAccessToken", refreshToken: "adminRefreshToken" };
	return (
		<QueryProvider>
			<AuthProvider baseUrl={BASE_URL} clientType="admin" cookieNames={cookieNames} navigate={navigate} refresh={refresh}>
				{children}
			</AuthProvider>
		</QueryProvider>
	);
}

beforeEach(() => {
	navigate = vi.fn<NavigateFn>();
	refresh = vi.fn<RefreshFn>();
	MockBroadcastChannel.instances.length = 0;
	vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
});

afterEach(() => {
	vi.unstubAllGlobals();
	// Clear any cookies set during the test (jsdom persists document.cookie between tests).
	document.cookie.split(";").forEach((cookie) => {
		const name = cookie.split("=")[0]?.trim();
		if (name) document.cookie = `${name}=; max-age=0; path=/`;
	});
});
describe("useAuth", () => {
	it("throws when used outside an AuthProvider", () => {
		expect(() => renderHook(() => useAuth())).toThrow(/useAuth must be used within AuthProvider/);
	});

	it("starts unauthenticated without an access-token cookie", () => {
		const { result } = renderHook(() => useAuth(), { wrapper });
		expect(result.current.isAuthenticated).toBe(false);
	});

	it("starts authenticated when the access-token cookie is present", () => {
		document.cookie = "accessToken=abc123";
		const { result } = renderHook(() => useAuth(), { wrapper });
		expect(result.current.isAuthenticated).toBe(true);
	});

	it("login() flips isAuthenticated to true and stores user", () => {
		const { result } = renderHook(() => useAuth(), { wrapper });
		act(() => {
			result.current.login(MOCK_USER);
		});
		expect(result.current.isAuthenticated).toBe(true);
		expect(result.current.user).toEqual(MOCK_USER);
	});
});
describe("AuthProvider logout", () => {
	it("clears the React Query cache on logout", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: { message: "Logged out" }, meta: { timestamp: 1786428000000 } }));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useAuth(), { wrapper });
		act(() => {
			result.current.login(MOCK_USER);
		});

		// Populate the query cache with the /auth/me result.
		const me = result.current.api.auth.me;
		await act(async () => {
			await me.fetch(undefined);
		});

		await act(async () => {
			await result.current.logout();
		});

		expect(result.current.isAuthenticated).toBe(false);
		// The logout endpoint call is the only one after the me fetch.
		expect(fetchCalls(fetchMock)).toHaveLength(2);
	});

	it("broadcasts logged-out to other tabs so they clear their sessions too", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: { message: "Logged out" }, meta: { timestamp: 1786428000000 } }));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useAuth(), { wrapper });

		// Spy on postMessage AFTER the provider mounted (login posts logged-in,
		// which would otherwise muddy the assertion) — then logout posts logged-out.
		const spy = vi.spyOn(MockBroadcastChannel.prototype, "postMessage");
		try {
			await act(async () => {
				await result.current.logout();
			});

			// Assert while the spy is still installed — `mockRestore()` below wipes
			// the recorded calls, so reading `spy.mock.calls` afterwards is empty.
			expect(spy).toHaveBeenCalledWith("logged-out");
		} finally {
			spy.mockRestore();
		}
	});

	it("calls the logout endpoint, clears state and navigates to login", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: { message: "Logged out" }, meta: { timestamp: 1786428000000 } }));
		vi.stubGlobal("fetch", fetchMock);

		document.cookie = "accessToken=abc123";
		const { result } = renderHook(() => useAuth(), { wrapper });
		act(() => {
			result.current.login(MOCK_USER);
		});

		await act(async () => {
			await result.current.logout();
		});

		expect(result.current.isAuthenticated).toBe(false);
		expect(navigate).toHaveBeenCalledWith("/auth/login");

		const calls = fetchCalls(fetchMock);
		expect(calls).toHaveLength(1);
		const call = calls[0];
		if (call === undefined) throw new Error("logout fetch was never called");
		expect(inputUrl(call.input)).toBe("http://api.test/api/v1/auth/logout");
		expect(call.init.method).toBe("POST");
		expect(call.init.credentials).toBe("include");

		// The proxy re-check is scheduled shortly after logout.
		await waitFor(() => {
			expect(refresh).toHaveBeenCalled();
		});
	});

	it("sends X-Client-Type: admin on logout for admin sessions", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: { message: "Logged out" }, meta: { timestamp: 1786428000000 } }));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useAuth(), { wrapper: adminWrapper });

		await act(async () => {
			await result.current.logout();
		});

		const calls = fetchCalls(fetchMock);
		const call = calls[0];
		if (call === undefined) throw new Error("logout fetch was never called");
		expect(call.init.method).toBe("POST");
		expect(headersOf(call.init)["X-Client-Type"]).toBe("admin");
	});

	it("does not storm refresh/unauthorized when parallel queries fail during logout", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { message: "Logged out" }, meta: { timestamp: 1786428000000 } }))
			.mockResolvedValue(jsonResponse(401, { message: "Unauthorized" }));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useAuth(), { wrapper });
		act(() => {
			result.current.login(MOCK_USER);
		});

		const me = result.current.api.auth.me;
		const permissions = result.current.api.auth.permissions;

		await act(async () => {
			const logoutPromise = result.current.logout();
			await Promise.all([me.fetch(undefined), permissions.fetch(undefined), logoutPromise]);
		});

		expect(result.current.isAuthenticated).toBe(false);
		expect(navigate).toHaveBeenCalledWith("/auth/login");
		expect(refreshCalls(fetchMock)).toHaveLength(0);
		expect(fetchCalls(fetchMock).length).toBeLessThanOrEqual(3);
	});
});

describe("AuthProvider cross-tab sync", () => {
	it("logs out locally when another tab broadcasts logged-out", () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(200, { success: true, data: { message: "OK" }, meta: { timestamp: 1786428000000 } }));
		vi.stubGlobal("fetch", fetchMock);

		document.cookie = "accessToken=abc123";
		const { result } = renderHook(() => useAuth(), { wrapper });
		act(() => {
			result.current.login(MOCK_USER);
		});
		expect(result.current.isAuthenticated).toBe(true);

		act(() => {
			postFromOtherTab("logged-out");
		});

		expect(result.current.isAuthenticated).toBe(false);
		expect(navigate).toHaveBeenCalledWith("/auth/login");
	});

	it("marks itself authenticated when another tab broadcasts logged-in", () => {
		const { result } = renderHook(() => useAuth(), { wrapper });
		expect(result.current.isAuthenticated).toBe(false);

		act(() => {
			postFromOtherTab("logged-in");
		});

		expect(result.current.isAuthenticated).toBe(true);
	});
});

describe("AuthProvider silent refresh", () => {
	it("single-flights concurrent refreshes from parallel 401s", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }))
			.mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }))
			.mockResolvedValueOnce(jsonResponse(200, REFRESH_BODY))
			.mockResolvedValueOnce(jsonResponse(200, ME_BODY))
			.mockResolvedValueOnce(jsonResponse(200, ME_BODY));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useAuth(), { wrapper });
		const me = result.current.api.auth.me;

		const [first, second] = await Promise.all([me.fetch(undefined), me.fetch(undefined)]);

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		// One refresh call shared by both 401s (rotation invalidates the old token,
		// so a second refresh would break the session).
		expect(refreshCalls(fetchMock)).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledTimes(5);
	});

	it("navigates to login and clears state when the refresh fails", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }))
			.mockResolvedValueOnce(jsonResponse(401, { message: "Refresh token expired" }));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useAuth(), { wrapper });
		const me = result.current.api.auth.me;

		const response = await me.fetch(undefined);

		expect(response.ok).toBe(false);
		expect(refreshCalls(fetchMock)).toHaveLength(1);
		expect(navigate).toHaveBeenCalledWith("/auth/login");
		expect(result.current.isAuthenticated).toBe(false);
	});

	it("sends X-Client-Type: admin when refreshing an admin session", async () => {
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValueOnce(jsonResponse(401, { message: "Unauthorized" }))
			.mockResolvedValueOnce(jsonResponse(200, REFRESH_BODY))
			.mockResolvedValueOnce(jsonResponse(200, ME_BODY));
		vi.stubGlobal("fetch", fetchMock);

		const { result } = renderHook(() => useAuth(), { wrapper: adminWrapper });
		const me = result.current.api.auth.me;

		const response = await me.fetch(undefined);

		expect(response.ok).toBe(true);
		const refreshCall = refreshCalls(fetchMock)[0];
		expect(refreshCall).toBeDefined();
		if (refreshCall !== undefined) {
			expect(headersOf(refreshCall.init)["X-Client-Type"]).toBe("admin");
		}
	});
});
