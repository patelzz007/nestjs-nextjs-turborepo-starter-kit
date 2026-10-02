// ============================================
// @workspace/client/lib/auth — the public auth entry point.
// The implementation is the `auth` feature store
// (src/lib/features/auth, ADR 023): session status in a per-mount store, the
// profile in TanStack Query, `useAuth()` as the facade over both.
// ============================================
"use client";

export {
	AuthProvider,
	CookieNamesConfigSchema,
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
	type CookieNamesConfig,
} from "../features/auth/facade";
export type { AuthSessionSource, AuthUser } from "./session/session";
export type { SessionCheckState } from "../features/auth/state";
