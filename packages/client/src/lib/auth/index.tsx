// ============================================
// lib/auth.tsx - Authentication Context
// IMPORTANT: This file MUST be named auth.tsx (not auth.ts)
// because it renders JSX (AuthProvider component).
// ============================================
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type JSX, type ReactNode } from "react";
import { z } from "zod";

import { createAuthChannel } from "./auth-sync";
import { API_BASE_URL } from "../api/config";
import { apiRouter } from "../api/endpoints";
import { apiFetch, createRefreshCooldown, useApi, type RefreshResult } from "../api/use-api";

export interface AuthContextType {
	isAuthenticated: boolean;
	isLoading: boolean;
	/**
	 * True until the first client-side mount tick completes (SSR + hydration).
	 * Consumers render a loading state instead of flashing the login form while
	 * auth state is established after a page reload.
	 */
	isInitializing: boolean;
	login: () => void;
	logout: () => Promise<void>;
	api: ReturnType<typeof useApi>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Cookie names for the web app — schema-derived type (rule 5). */
export const CookieNamesConfigSchema = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
});

export type CookieNamesConfig = z.output<typeof CookieNamesConfigSchema>;

/** Default cookie names for the web app */
const DEFAULT_COOKIE_NAMES: Readonly<CookieNamesConfig> = {
	accessToken: "accessToken",
	refreshToken: "refreshToken",
};

function getCookie(name: string): string | null {
	if (typeof window === "undefined") return null;

	const cookies = document.cookie.split("; ");
	const cookie = cookies.find((c) => c.startsWith(`${name}=`));
	return cookie ? (cookie.split("=")[1] ?? null) : null;
}

/**
 * True when the session access-token cookie is present.
 *
 * Note: this reads the *httpOnly* access-token cookie, which browser JS cannot
 * actually see via `document.cookie` — so it returns `false` in practice. The
 * route proxies perform the real presence check server-side (where httpOnly
 * cookies ARE readable); `isAuthenticated` is only for client-side state
 * consistency (cleared on logout / failed refresh). Nothing gates on it.
 */
function checkAuthStatus(accessTokenName: string): boolean {
	return getCookie(accessTokenName) !== null;
}

// True until the first client mount completes. The store starts "not mounted"
// (false) on the server AND on the client's first render, then flips to true in
// a mount effect. `isInitializing` is derived as `!mounted`, so it reads true
// during that window. The flip MUST notify subscribers — without it
// useSyncExternalStore never re-renders and the hydration spinner spins
// forever (a flip from false→true is also a real change vs. the hydrated
// snapshot, which a pre-initialized true would not be).
let clientMounted = false;
const hydrationListeners = new Set<() => void>();

function setClientMounted(mounted: boolean): void {
	clientMounted = mounted;
	hydrationListeners.forEach((listener) => {
		listener();
	});
}

/**
 * Test-only reset for the hydration flag. `clientMounted` is module-scoped, so
 * it survives across tests in the same file — this lets each test start from
 * the pre-mount state (isInitializing === true on the very first render).
 */
export function resetAuthHydrationForTests(): void {
	clientMounted = false;
}

/**
 * External store tracking whether the client has completed its first mount.
 * `getServerSnapshot` returns `false` (the server is never "mounted");
 * `getSnapshot` flips to `true` after the mount effect. `isInitializing` is the
 * negation of this value, so SSR + the first client render report
 * "initializing", and the first mount tick flips the UI to content.
 */
const hydrationStore: {
	readonly subscribe: (onStoreChange: () => void) => () => void;
	readonly getSnapshot: () => boolean;
	readonly getServerSnapshot: () => boolean;
} = {
	subscribe: (onStoreChange: () => void): (() => void) => {
		hydrationListeners.add(onStoreChange);
		return (): void => {
			hydrationListeners.delete(onStoreChange);
		};
	},
	getSnapshot: (): boolean => clientMounted,
	getServerSnapshot: (): boolean => false,
};

export interface AuthProviderProps {
	readonly children: ReactNode;
	/**
	 * Base URL of the API. Defaults to the env-driven `API_BASE_URL`
	 * (see lib/config.ts) — override only when you need a per-call value.
	 */
	readonly baseUrl?: string;
	readonly onUnauthorizedRedirect?: string;
	readonly navigate?: (url: string) => void;
	readonly refresh?: () => void;
	/**
	 * Cookie names to check for authentication status.
	 * Defaults to accessToken / refreshToken (web app).
	 * The admin panel passes adminAccessToken / adminRefreshToken.
	 */
	readonly cookieNames?: CookieNamesConfig;
	/**
	 * Client type identifier. When set to "admin", the logout request
	 * sends `X-Client-Type: admin` so the backend only clears the
	 * admin cookie set (not the web cookies).
	 */
	readonly clientType?: "web" | "admin";
}

export function AuthProvider({
	children,
	baseUrl = API_BASE_URL,
	onUnauthorizedRedirect = "/auth/login",
	navigate,
	refresh,
	cookieNames = DEFAULT_COOKIE_NAMES,
	clientType,
}: AuthProviderProps): JSX.Element {
	const queryClient = useQueryClient();
	const [isLoading] = useState(false);

	// Memoize so checkAuthStatus only re-runs when cookieNames changes
	const [isAuthenticated, setIsAuthenticated] = useState(() => checkAuthStatus(cookieNames.accessToken));

	// True on SSR + the first client render; flipped false after the first
	// mount tick so consumers can avoid flashing the login form on reload.
	// Implemented as a tiny external store read via useSyncExternalStore — the
	// canonical hydration pattern (no setState-in-effect, works with SSR).
	const isInitializing = !useSyncExternalStore(hydrationStore.subscribe, hydrationStore.getSnapshot, hydrationStore.getServerSnapshot);

	// The one-time flip that ends the initializing window on the client.
	// `setClientMounted` notifies the store's subscribers, so useSyncExternalStore
	// re-renders and `isInitializing` becomes false (without the notification the
	// spinner would stay stuck on screen after the first paint).
	useEffect((): void => {
		setClientMounted(true);
	}, []);

	// Cross-tab sync: one channel per auth context (web vs admin cookie set).
	// Each provider owns its channel and closes it on unmount so a fresh
	// provider (new tab / re-mount) gets a clean channel with no stale listeners.
	const syncChannel = useMemo(() => createAuthChannel(`freebuff:auth:${cookieNames.accessToken}`), [cookieNames.accessToken]);

	useEffect((): (() => void) => {
		return (): void => {
			syncChannel.close();
		};
	}, [syncChannel]);

	// Handle 401 responses from the API
	const handleUnauthorized = useCallback((): void => {
		setIsAuthenticated(false);
		queryClient.clear();
		syncChannel.post("logged-out");
		navigate?.(onUnauthorizedRedirect);
	}, [navigate, onUnauthorizedRedirect, queryClient, syncChannel]);

	// Single-flight refresh: concurrent 401s share ONE refresh call so the
	// refresh token is only rotated once (rotation invalidates the old token).
	const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

	const performRefresh = useCallback(async (): Promise<RefreshResult> => {
		try {
			// Uses `apiFetch` (not `useApi`) deliberately: refresh must not re-enter
			// the 401-refresh-unauthorized pipeline it drives, and `useApi` is built
			// *from* this callback, so depending on it would be circular. The path
			// and method still come from the typed endpoint registry.
			const response = await apiFetch(baseUrl, apiRouter.auth.refresh.method, apiRouter.auth.refresh.path, {
				headers: clientType === "admin" ? { "X-Client-Type": "admin" } : undefined,
			});
			if (response.ok) return "ok";
			// The server rejected the refresh (expired/invalid refresh token) — the
			// session is genuinely dead, not just unreachable.
			if (response.status === 401) return "expired";
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
	const cooldownRefreshRef = useRef<ReturnType<typeof createRefreshCooldown> | null>(null);
	cooldownRefreshRef.current ??= createRefreshCooldown(performRefresh);
	const cooldownRefresh: ReturnType<typeof createRefreshCooldown> = cooldownRefreshRef.current;

	const handleRefresh = useCallback((): Promise<boolean> => {
		// `??=` keeps single-flight semantics: the IIFE only runs while the ref is
		// null; concurrent 401s share the same in-flight promise. `finally` resets
		// the ref to null once settled so a future 401 can refresh again.
		// The cooldown wrapper (stable via ref above) short-circuits repeated
		// transient failures.
		refreshPromiseRef.current ??= (async (): Promise<boolean> => {
			try {
				return await cooldownRefresh();
			} finally {
				refreshPromiseRef.current = null;
			}
		})();
		return refreshPromiseRef.current;
	}, [cooldownRefresh]);

	// Initialize the API hook with cookie auth + silent refresh on 401
	const api = useApi(baseUrl, handleUnauthorized, handleRefresh);

	// Called after successful login — just updates state and tells other tabs
	// (the actual tokens are managed by the backend via httpOnly cookies).
	const login = useCallback((): void => {
		setIsAuthenticated(true);
		syncChannel.post("logged-in");
	}, [syncChannel]);

	const logout = useCallback(async (): Promise<void> => {
		try {
			// Send X-Client-Type header so the backend only clears the relevant
			// cookie set (web vs admin). Like refresh, this deliberately bypasses
			// the `useApi` pipeline (logout must not trigger the 401-refresh flow)
			// while still using the registry's path/method.
			const response = await apiFetch(baseUrl, apiRouter.auth.logout.method, apiRouter.auth.logout.path, {
				headers: clientType === "admin" ? { "X-Client-Type": "admin" } : undefined,
			});
			// `apiFetch` converts network failures into `ok: false` rather than
			// throwing, so surface those here for observability.
			if (!response.ok) {
				console.error("Logout request failed:", response.status);
			}
		} catch (error) {
			// Only reachable for unexpected local errors.
			console.error("Logout request failed:", error);
		} finally {
			setIsAuthenticated(false);
			queryClient.clear();
			syncChannel.post("logged-out");
			navigate?.(onUnauthorizedRedirect);
			// Refresh to trigger proxy re-check
			setTimeout(() => {
				refresh?.();
			}, 100);
		}
	}, [baseUrl, navigate, onUnauthorizedRedirect, refresh, clientType, queryClient, syncChannel]);

	// Receive cross-tab logout events: another tab cleared the session (shared
	// cookie jar), so this tab must clear its React Query cache and bounce to
	// login too — closing the rotation-race gap documented in the token-refresh
	// docs. `logged-in` just marks this tab authenticated.
	useEffect((): (() => void) => {
		return syncChannel.subscribe((event): void => {
			if (event === "logged-out") {
				handleUnauthorized();
			} else {
				setIsAuthenticated(true);
			}
		});
	}, [syncChannel, handleUnauthorized]);

	const value: AuthContextType = useMemo(
		() => ({
			isAuthenticated,
			isLoading,
			isInitializing,
			login,
			logout,
			api,
		}),
		[isAuthenticated, isLoading, isInitializing, login, logout, api],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
}
