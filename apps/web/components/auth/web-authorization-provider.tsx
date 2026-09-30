"use client";

import { useSessionPermissionsQuery } from "@/lib/session/capabilities";
import { useAuth } from "@workspace/client/lib/auth";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import type { CapabilitySlug, SessionPermissionsResponse } from "@workspace/shared";
import * as React from "react";

export interface WebSessionState {
	/** Signed-in (or, before client revalidation finishes, the server saw a session cookie). */
	readonly isAuthenticated: boolean;
	/** True once the capability set is known — gates wait instead of flashing a denial. */
	readonly isResolved: boolean;
	/** Same list `CapabilitiesProvider` receives (sidebar filtering needs the raw slugs). */
	readonly capabilities: readonly CapabilitySlug[];
	/** Latest `GET /auth/permissions` answer — `undefined` for guests. */
	readonly session: SessionPermissionsResponse | undefined;
}

const GUEST_SESSION: WebSessionState = {
	isAuthenticated: false,
	isResolved: true,
	capabilities: [],
	session: undefined,
};

const WebSessionContext = React.createContext<WebSessionState>(GUEST_SESSION);

export interface WebAuthorizationProviderProps {
	/** Server saw a recoverable session cookie on this request. */
	readonly sessionActive: boolean;
	/** SSR `GET /auth/permissions` answer for first paint. */
	readonly initialSessionPermissions?: SessionPermissionsResponse;
	readonly children: React.ReactNode;
}

/**
 * Single live capability source for the whole web app. Mounted once in the
 * root layout; wraps children in `CapabilitiesProvider` so `useAuthorization()`
 * and `<Can>` work on every page. Guests get an empty capability set (every
 * gated control denies). Purely advisory UX — the API remains authoritative.
 */
export function WebAuthorizationProvider({ sessionActive, initialSessionPermissions, children }: WebAuthorizationProviderProps): React.JSX.Element {
	const { user, isLoading } = useAuth();
	// Until the client finishes revalidating, trust the server's cookie check so
	// SSR and first client render agree; afterwards the auth store decides
	// (logout clears it immediately, client-side login sets it).
	const isAuthenticated = user !== null || (isLoading && sessionActive);

	const { capabilities, session, isResolved } = useSessionPermissionsQuery(initialSessionPermissions, isAuthenticated);

	const value = React.useMemo((): WebSessionState => ({ isAuthenticated, isResolved, capabilities, session }), [capabilities, isAuthenticated, isResolved, session]);

	return (
		<WebSessionContext.Provider value={value}>
			<CapabilitiesProvider capabilities={capabilities}>{children}</CapabilitiesProvider>
		</WebSessionContext.Provider>
	);
}

/** Authentication + session-permission state from the nearest `WebAuthorizationProvider` (guest when absent). */
export function useWebSession(): WebSessionState {
	return React.useContext(WebSessionContext);
}

export interface WebSessionTestProviderProps {
	readonly session: WebSessionState;
	readonly children: React.ReactNode;
}

/** Static provider for tests and stories — no API calls. */
export function WebSessionTestProvider({ session, children }: WebSessionTestProviderProps): React.JSX.Element {
	return (
		<WebSessionContext.Provider value={session}>
			<CapabilitiesProvider capabilities={session.capabilities}>{children}</CapabilitiesProvider>
		</WebSessionContext.Provider>
	);
}
