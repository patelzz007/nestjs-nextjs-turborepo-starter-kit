// ============================================
// @workspace/client/lib/contexts/identity — the public auth entry point.
// The implementation is the `auth` feature store
// (src/lib/features/auth, ADR 023): session status in a per-mount store, the
// profile in TanStack Query, `useAuth()` as the facade over both.
// ============================================
"use client";

export {
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
} from "../../features/auth/facade";
export type { AuthUser } from "./session/session";
export type { ServerRenderedSession } from "./session/server-rendered-session";
export { isRestrictedAuthUser, resolveAuthEnrollmentReason } from "./session/session";
export type { SessionCheckState } from "../../features/auth/state";

// Shared with the organizations context (KYB, merchant onboarding).
export { resolveAuthErrorMessage } from "../../api/error-messages";
export { passwordStrength, type PasswordStrengthResult } from "./password";
// Shared with the authorization context (a role change refreshes the session's grants).
export { invalidateSessionAuth } from "./session/invalidate-auth";
// Shared with the organizations context (impersonating a merchant from its table).
export { useImpersonation, type ImpersonationControls, type ImpersonationTarget, type UseImpersonationOptions } from "./session/use-impersonation";
