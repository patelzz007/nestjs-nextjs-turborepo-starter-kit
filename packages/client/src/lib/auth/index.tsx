// ============================================
// lib/auth.tsx - Authentication Context
// IMPORTANT: This file MUST be named auth.tsx (not auth.ts)
// because it renders JSX (AuthProvider component).
// ============================================
"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { z } from "zod";

import { createAuthChannel } from "./auth-sync";
import { API_BASE_URL } from "../api/config";
import { apiRouter } from "../api/endpoints";
import { createRefreshCooldown, createUncheckedApiRequestContext, fetchMutationUnchecked, useApi, type ApiClient, type RefreshResult } from "../api/use-api";
import type { ApiRouter } from "../api/endpoints";
import { useAuthStore, type AuthUser } from "./auth-store";

export interface AuthContextType {
	isAuthenticated: boolean;
	isLoading: boolean;
	/** The currently authenticated user, or null if not authenticated. */
	readonly user: AuthUser | null;
	/** Set the user after successful login. */
	login: (user: AuthUser) => void;
	logout: () => Promise<void>;
	api: ApiClient<ApiRouter>;
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
	readonly clientType?: "web" | "admin" | "merchant";
	/** Extra headers sent on every API request from this auth context. */
	readonly extraHeaders?: Record<string, string>;
	/**
	 * When a 401 invalidates the session, navigation to `onUnauthorizedRedirect`
	 * only happens if this returns true. Defaults to always redirect.
	 */
	readonly shouldRedirectOnUnauthorized?: () => boolean;
}

export function AuthProvider({
	children,
	baseUrl = API_BASE_URL,
	onUnauthorizedRedirect = "/auth/login",
	navigate,
	refresh,
	cookieNames = DEFAULT_COOKIE_NAMES,
	clientType,
	extraHeaders,
	shouldRedirectOnUnauthorized,
}: AuthProviderProps): JSX.Element {
	const queryClient = useQueryClient();
	const [isLoading] = useState(false);
	const { user, setUser, clearUser } = useAuthStore();

	// Memoize so checkAuthStatus only re-runs when cookieNames changes
	const [isAuthenticated, setIsAuthenticated] = useState(() => checkAuthStatus(cookieNames.accessToken));

	// Cross-tab sync: one channel per auth context (web vs admin cookie set).
	// Each provider owns its channel and closes it on unmount so a fresh
	// provider (new tab / re-mount) gets a clean channel with no stale listeners.
	const syncChannel = useMemo(() => createAuthChannel(`freebuff:auth:${cookieNames.accessToken}`), [cookieNames.accessToken]);

	useEffect((): (() => void) => {
		return (): void => {
			syncChannel.close();
		};
	}, [syncChannel]);

	// Once true, in-flight queries must not trigger refresh/unauthorized storms.
	const sessionInvalidatedRef = useRef<boolean>(false);

	interface InvalidateSessionOptions {
		readonly broadcast?: boolean;
		readonly navigateAway?: boolean;
	}

	const invalidateSession = useCallback(
		async (options?: InvalidateSessionOptions): Promise<void> => {
			if (sessionInvalidatedRef.current) {
				return;
			}
			sessionInvalidatedRef.current = true;
			clearUser();
			setIsAuthenticated(false);

			if (options?.broadcast !== false) {
				syncChannel.post("logged-out");
			}

			if (options?.navigateAway !== false) {
				const shouldRedirect = shouldRedirectOnUnauthorized?.() ?? true;
				if (shouldRedirect) {
					navigate?.(onUnauthorizedRedirect);
				}
			}

			await queryClient.cancelQueries();
			queryClient.clear();
		},
		[clearUser, navigate, onUnauthorizedRedirect, queryClient, shouldRedirectOnUnauthorized, syncChannel],
	);

	// Handle 401 responses from the API — single-flight so parallel failures
	// don't each clear the cache, broadcast, and redirect.
	const handleUnauthorized = useCallback(async (): Promise<void> => {
		await invalidateSession();
	}, [invalidateSession]);

	// Single-flight refresh: concurrent 401s share ONE refresh call so the
	// refresh token is only rotated once (rotation invalidates the old token).
	const refreshPromiseRef = useRef<Promise<boolean> | null>(null);

	const performRefresh = useCallback(async (): Promise<RefreshResult> => {
		try {
			// Uses `fetchMutationUnchecked` (not `useApi`) deliberately: refresh must not
			// re-enter the 401-refresh-unauthorized pipeline it drives. The procedure
			// def still comes from the typed endpoint registry.
			const uncheckedContext = createUncheckedApiRequestContext(baseUrl, { clientType });
			const response = await fetchMutationUnchecked(uncheckedContext, apiRouter.auth.refresh, {});
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
		if (sessionInvalidatedRef.current) {
			return Promise.resolve(false);
		}
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
	const api = useApi(apiRouter, baseUrl, handleUnauthorized, handleRefresh, { clientType, extraHeaders });

	// Called after successful login — stores user in Zustand and tells other tabs
	// (the actual tokens are managed by the backend via httpOnly cookies).
	const login = useCallback(
		(user: AuthUser): void => {
			sessionInvalidatedRef.current = false;
			setUser(user);
			setIsAuthenticated(true);
			syncChannel.post("logged-in");
		},
		[syncChannel, setUser],
	);

	const logout = useCallback(async (): Promise<void> => {
		// Stop mounted queries from retrying/refreshing before cookies are cleared.
		await invalidateSession({ broadcast: false, navigateAway: false });

		try {
			const uncheckedContext = createUncheckedApiRequestContext(baseUrl, { clientType });
			const response = await fetchMutationUnchecked(uncheckedContext, apiRouter.auth.logout, {});
			if (!response.ok) {
				console.error("Logout request failed:", response.status);
			}
		} catch (error) {
			console.error("Logout request failed:", error);
		} finally {
			syncChannel.post("logged-out");
			navigate?.(onUnauthorizedRedirect);
			setTimeout(() => {
				refresh?.();
			}, 100);
		}
	}, [baseUrl, clientType, invalidateSession, navigate, onUnauthorizedRedirect, refresh, syncChannel]);

	// Receive cross-tab logout events: another tab cleared the session (shared
	// cookie jar), so this tab must clear its React Query cache and bounce to
	// login too — closing the rotation-race gap documented in the token-refresh
	// docs. `logged-in` just marks this tab authenticated.
	useEffect((): (() => void) => {
		return syncChannel.subscribe((event): void => {
			if (event === "logged-out") {
				void invalidateSession({ broadcast: false });
			} else {
				sessionInvalidatedRef.current = false;
				setIsAuthenticated(true);
			}
		});
	}, [syncChannel, invalidateSession]);

	const value: AuthContextType = useMemo(
		() => ({
			isAuthenticated,
			isLoading,
			user,
			login,
			logout,
			api,
		}),
		[isAuthenticated, isLoading, user, login, logout, api],
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
