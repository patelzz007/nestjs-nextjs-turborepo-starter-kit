"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

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
 * In-memory Zustand store for auth state. User identity is never persisted —
 * each document bootstraps from `/auth/me` or server-provided state.
 */
export const useAuthStore = create<AuthStore>()(
	devtools(
		(set) => ({
			user: null,
			isAuthenticated: false,

			setUser: (user: AuthUser): void => {
				set({ user, isAuthenticated: true }, false, "setUser");
			},

			clearUser: (): void => {
				set({ user: null, isAuthenticated: false }, false, "clearUser");
			},
		}),
		{
			name: "AuthStore",
			serialize: { depth: 3 },
		},
	),
);

/**
 * Convenience hook to access just the user object from the auth store.
 */
export function useAuthUser(): AuthUser | null {
	return useAuthStore((state: AuthStore): AuthUser | null => state.user);
}
