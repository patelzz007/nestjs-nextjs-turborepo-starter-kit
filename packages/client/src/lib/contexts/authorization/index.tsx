"use client";

import * as React from "react";

import type { CapabilitySlug } from "@workspace/shared";

import { createGrantedCapabilities, isCapabilityGranted, type GrantedCapabilities } from "./permission-check";

/**
 * Requirement evaluation mode for multi-permission checks:
 * - "all" — every capability must be granted (AND).
 * - "any" — at least one capability must be granted (OR, default).
 */
export type CapabilityCheckMode = "all" | "any";

/**
 * Synchronous authorization checks backed by the session capability set
 * (each capability held exactly). For showing and
 * hiding UI only: the API checks every request again, record by record.
 */
export interface AuthorizationChecker {
	/** True when the permission is granted. */
	readonly can: (permission: CapabilitySlug) => boolean;
	/** Negation of `can` — reads better in disabled/hidden conditions. */
	readonly cannot: (permission: CapabilitySlug) => boolean;
	/** AND semantics — true when every permission is granted. */
	readonly canAll: (permissions: readonly CapabilitySlug[]) => boolean;
	/** OR semantics — true when at least one permission is granted. */
	readonly canAny: (permissions: readonly CapabilitySlug[]) => boolean;
}

/** Back-compat name for {@link AuthorizationChecker}. */
export type CapabilitiesChecker = AuthorizationChecker;

const CapabilitiesContext = React.createContext<AuthorizationChecker | null>(null);

function createChecker(granted: GrantedCapabilities): AuthorizationChecker {
	const can = (permission: CapabilitySlug): boolean => isCapabilityGranted(granted, permission);

	return {
		can,
		cannot: (permission) => !can(permission),
		canAll: (permissions) => permissions.every(can),
		canAny: (permissions) => permissions.some(can),
	};
}

const DENY_ALL_CHECKER: AuthorizationChecker = createChecker(createGrantedCapabilities([]));

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
	const checker = React.useMemo(() => createChecker(createGrantedCapabilities(capabilities)), [capabilities]);

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
export function Can({ permission, permissions, mode = "any", fallback = null, children }: CanProps): React.JSX.Element {
	const { can, canAll, canAny } = useAuthorization();

	const allowed = React.useMemo(() => {
		if (permissions !== undefined) {
			return mode === "all" ? canAll(permissions) : canAny(permissions);
		}
		return permission !== undefined && can(permission);
	}, [can, canAll, canAny, mode, permission, permissions]);

	if (!allowed) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
