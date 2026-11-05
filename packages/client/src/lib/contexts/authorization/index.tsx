"use client";

import * as React from "react";

import type { CapabilitySlug } from "@workspace/shared";

import { createAuthorizationChecker, meetsRequirement, type AuthorizationChecker, type CapabilityCheckMode } from "./permission-check";

export type { AuthorizationChecker, CapabilityCheckMode } from "./permission-check";

/** Back-compat name for {@link AuthorizationChecker}. */
export type CapabilitiesChecker = AuthorizationChecker;

const CapabilitiesContext = React.createContext<AuthorizationChecker | null>(null);

const DENY_ALL_CHECKER: AuthorizationChecker = createAuthorizationChecker([]);

export interface CapabilitiesProviderProps {
	/** Granted capability slugs from `GET /auth/permissions`. */
	readonly capabilities: readonly CapabilitySlug[];
	readonly children: React.ReactNode;
}

/**
 * Provides the session capability set for `useAuthorization()` / `<Can>`
 * consumers. Purely advisory UX state — the backend remains authoritative.
 */
export function CapabilitiesProvider({ capabilities, children }: CapabilitiesProviderProps): React.JSX.Element {
	const checker = React.useMemo(() => createAuthorizationChecker(capabilities), [capabilities]);

	return <CapabilitiesContext.Provider value={checker}>{children}</CapabilitiesContext.Provider>;
}

/**
 * Local, synchronous authorization checks (never calls the API):
 *
 * ```tsx
 * const auth = useAuthorization();
 * <Button disabled={auth.cannot(PERMISSION.USER.DELETE)} />
 * ```
 *
 * Falls back to a deny-all checker when no provider is present: fail closed.
 */
export function useAuthorization(): AuthorizationChecker {
	return React.useContext(CapabilitiesContext) ?? DENY_ALL_CHECKER;
}

/** Alias of {@link useAuthorization} kept for existing callers. */
export function useCan(): AuthorizationChecker {
	return useAuthorization();
}

export interface CanProps {
	/** Single required capability. */
	readonly permission?: CapabilitySlug;
	/** Alternative: multiple capabilities evaluated with `mode` semantics. */
	readonly permissions?: readonly CapabilitySlug[];
	readonly mode?: CapabilityCheckMode;
	/** Rendered when the requirement is not met. */
	readonly fallback?: React.ReactNode;
	readonly children: React.ReactNode;
}

/**
 * Conditional render gate:
 *
 * ```tsx
 * <Can permission={PERMISSION.USER.DELETE} fallback={<DisabledButton />}>
 *   <DeleteButton />
 * </Can>
 * ```
 */
export function Can({ permission, permissions, mode, fallback = null, children }: CanProps): React.JSX.Element {
	const checker = useAuthorization();
	const allowed = React.useMemo(() => meetsRequirement(checker, { permission, permissions, mode }), [checker, mode, permission, permissions]);

	if (!allowed) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
