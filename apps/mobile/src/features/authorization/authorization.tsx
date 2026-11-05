// Showing and hiding by capability on the phone: the web's `useAuthorization()` / `<Can>`
// (packages/client), over the same checker (@workspace/shared `createAuthorizationChecker`). The
// session's capabilities come from `GET /auth/permissions`; until they arrive, and when they cannot,
// every check is denied (fail closed). Purely UX: the API checks every request again.

import * as React from "react";

import { createAuthorizationChecker, meetsRequirement, type AuthorizationChecker, type CanRequirement, type CapabilitySlug } from "@workspace/shared";

import { useApi } from "../../lib/api-context";

interface SessionAuthorization {
	/** The capabilities held, as the API listed them (the drawer filters its menu by them). */
	readonly capabilities: readonly CapabilitySlug[];
	readonly checker: AuthorizationChecker;
}

const NO_CAPABILITIES: readonly CapabilitySlug[] = [];

const DENY_ALL: SessionAuthorization = { capabilities: NO_CAPABILITIES, checker: createAuthorizationChecker(NO_CAPABILITIES) };

const AuthorizationContext = React.createContext<SessionAuthorization>(DENY_ALL);

export interface CapabilitiesProviderProps {
	readonly capabilities: readonly CapabilitySlug[];
	readonly children: React.ReactNode;
}

/** Provides a capability set to `useAuthorization()`, `useCapabilities()` and `<Can>` below it. */
export function CapabilitiesProvider({ capabilities, children }: CapabilitiesProviderProps): React.JSX.Element {
	const value = React.useMemo((): SessionAuthorization => ({ capabilities, checker: createAuthorizationChecker(capabilities) }), [capabilities]);
	return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>;
}

export interface SessionCapabilitiesProviderProps {
	readonly children: React.ReactNode;
}

/** The signed-in session's capabilities (`GET /auth/permissions`), none until they have loaded. */
export function SessionCapabilitiesProvider({ children }: SessionCapabilitiesProviderProps): React.JSX.Element {
	const api = useApi();
	const permissions = api.auth.permissions.useQuery(undefined);
	return <CapabilitiesProvider capabilities={permissions.data?.data.capabilities ?? NO_CAPABILITIES}>{children}</CapabilitiesProvider>;
}

/** Local, synchronous checks (never calls the API); deny-all outside a provider. */
export function useAuthorization(): AuthorizationChecker {
	return React.useContext(AuthorizationContext).checker;
}

/** The capabilities held, for filtering a whole menu at once. */
export function useCapabilities(): readonly CapabilitySlug[] {
	return React.useContext(AuthorizationContext).capabilities;
}

export interface CanProps extends CanRequirement {
	/** Shown when the requirement is not met (nothing by default). */
	readonly fallback?: React.ReactNode;
	readonly children: React.ReactNode;
}

/** Renders `children` only when the session meets the requirement: `<Can permission={PERMISSION.SERVER_METRIC.LIST}>`. */
export function Can({ fallback = null, children, ...requirement }: CanProps): React.ReactNode {
	const checker = useAuthorization();
	return meetsRequirement(checker, requirement) ? children : fallback;
}
