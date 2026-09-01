"use client";

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

/**
 * User object stored in the auth store after login.
 * This is a subset of the full user response — just the fields needed client-side.
 */
export interface AuthUser {
	readonly id: string;
	readonly email: string;
	readonly fullName: string;
	readonly isSuperAdmin: boolean;
	readonly hasAdminAccess: boolean;
	readonly isEmailVerified: boolean;
	readonly roles: readonly { readonly id: string; readonly name: string }[];
}

/**
 * Auth store state shape.
 */
export interface AuthState {
	/** The currently authenticated user, or null if not authenticated. */
	readonly user: AuthUser | null;
	/** Whether the user is authenticated. */
	readonly isAuthenticated: boolean;
}

/**
 * Auth store actions.
 */
export interface AuthActions {
	/** Set the user after successful login. */
	readonly setUser: (user: AuthUser) => void;
	/** Clear the user on logout. */
	readonly clearUser: () => void;
}

/**
 * Combined store type.
 */
export type AuthStore = AuthState & AuthActions;

/**
 * Zustand store for auth state with Redux DevTools support.
 *
 * The user object is persisted to sessionStorage so it survives page reloads
 * without an extra API call. On logout, the store is cleared.
 *
 * Usage:
 * ```ts
 * const { user, setUser, clearUser } = useAuthStore();
 * ```
 */
export const useAuthStore = create<AuthStore>()(
	devtools(
		persist(
			(set) => ({
				// ── State ──────────────────────────────────────────────────
				user: null,
				isAuthenticated: false,

				// ── Actions ────────────────────────────────────────────────
				setUser: (user: AuthUser): void => {
					set({ user, isAuthenticated: true }, false, "setUser");
				},

				clearUser: (): void => {
					set({ user: null, isAuthenticated: false }, false, "clearUser");
				},
			}),
			{
				name: "auth-store",
				// Only persist user + isAuthenticated, not actions
				partialize: (state: AuthStore): AuthState => ({
					user: state.user,
					isAuthenticated: state.isAuthenticated,
				}),
			},
		),
		{
			name: "AuthStore",
			// Limit serialized depth to avoid oversized payloads in DevTools.
			serialize: { depth: 3 },
		},
	),
);

/**
 * Convenience hook to access just the user object from the auth store.
 *
 * Returns `null` when not authenticated.
 *
 * Usage:
 * ```ts
 * const user = useAuthUser();
 * if (user) {
 *   console.log(user.fullName);
 * }
 * ```
 */
export function useAuthUser(): AuthUser | null {
	return useAuthStore((state: AuthStore): AuthUser | null => state.user);
}
