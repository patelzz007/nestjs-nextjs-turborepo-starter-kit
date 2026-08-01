// ============================================
// lib/auth.tsx - Authentication Context
// IMPORTANT: This file MUST be named auth.tsx (not auth.ts)
// because it renders JSX (AuthProvider component).
// ============================================
"use client";

import { createContext, useCallback, useContext, useMemo, useState, type JSX, type ReactNode } from "react";

import { API_BASE_URL } from "./config";
import { useApi } from "./use-api";

export interface AuthContextType {
	isAuthenticated: boolean;
	isLoading: boolean;
	login: () => void;
	logout: () => Promise<void>;
	api: ReturnType<typeof useApi>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Default cookie names for the web app */
const DEFAULT_COOKIE_NAMES: Readonly<{ accessToken: string; refreshToken: string }> = {
	accessToken: "accessToken",
	refreshToken: "refreshToken",
};

export interface CookieNamesConfig {
	readonly accessToken: string;
	readonly refreshToken: string;
}

function getCookie(name: string): string | null {
	if (typeof window === "undefined") return null;

	const cookies = document.cookie.split("; ");
	const cookie = cookies.find((c) => c.startsWith(`${name}=`));
	return cookie ? (cookie.split("=")[1] ?? null) : null;
}

function checkAuthStatus(accessTokenName: string, refreshTokenName: string): boolean {
	const accessToken = getCookie(accessTokenName);
	const refreshToken = getCookie(refreshTokenName);
	return !!(accessToken && refreshToken);
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
	const [isLoading] = useState(false);

	// Memoize so checkAuthStatus only re-runs when cookieNames changes
	const [isAuthenticated, setIsAuthenticated] = useState(() => checkAuthStatus(cookieNames.accessToken, cookieNames.refreshToken));

	// Handle 401 responses from the API
	const handleUnauthorized = useCallback((): void => {
		setIsAuthenticated(false);
		navigate?.(onUnauthorizedRedirect);
	}, [navigate, onUnauthorizedRedirect]);

	// Initialize the API hook with cookie auth
	const api = useApi(baseUrl, handleUnauthorized);

	// Called after successful login — just updates state.
	// The actual tokens are managed by the backend via httpOnly cookies.
	const login = useCallback((): void => {
		setIsAuthenticated(true);
	}, []);

	const logout = useCallback(async (): Promise<void> => {
		try {
			// Send X-Client-Type header so the backend only clears the
			// relevant cookie set (web vs admin).
			await fetch(`${baseUrl}/auth/logout`, {
				method: "POST",
				headers: clientType === "admin" ? { "X-Client-Type": "admin" } : undefined,
				credentials: "include",
			});
		} catch (error) {
			console.error("Logout request failed:", error);
		} finally {
			setIsAuthenticated(false);
			navigate?.(onUnauthorizedRedirect);
			// Refresh to trigger proxy re-check
			setTimeout(() => {
				refresh?.();
			}, 100);
		}
	}, [baseUrl, navigate, onUnauthorizedRedirect, refresh, clientType]);

	const value: AuthContextType = useMemo(
		() => ({
			isAuthenticated,
			isLoading,
			login,
			logout,
			api,
		}),
		[isAuthenticated, isLoading, login, logout, api],
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
