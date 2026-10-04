"use client";

import { useAuth, useIsServerRenderedSession } from "@workspace/client/lib/auth";
import type { CapabilitySlug, Envelope, SessionPermissionsResponse } from "@workspace/shared";
import * as React from "react";

import { initialDataOption } from "@workspace/client/lib/api/envelope";

/** Re-checks revocations promptly without hammering the API. */
export const SESSION_PERMISSIONS_REFETCH_INTERVAL_MS = 60_000;

const NO_CAPABILITIES: readonly CapabilitySlug[] = [];

export interface SessionPermissionsState {
	/** Capability slugs fed into `CapabilitiesProvider` — the single client source of truth. */
	readonly capabilities: readonly CapabilitySlug[];
	/** Latest `GET /auth/permissions` answer (live, else preloaded) — `undefined` for guests. */
	readonly session: SessionPermissionsResponse | undefined;
	/** True once there is a permissions answer (live, preloaded, or a definitive error) — always true for guests. */
	readonly isResolved: boolean;
}

/**
 * Picks the capability list to trust. The live query wins whenever it has
 * data — **even an empty list**, so permissions revoked to zero disappear —
 * and the server-preloaded list is used only before the first live answer.
 */
export function resolveSessionCapabilities(live: SessionPermissionsResponse | undefined, preloaded: SessionPermissionsResponse | undefined): readonly CapabilitySlug[] {
	if (live !== undefined) {
		return live.capabilities;
	}
	return preloaded?.capabilities ?? NO_CAPABILITIES;
}

/**
 * Owns `GET /auth/permissions` for the consumer web app. Mounted once by
 * `WebAuthorizationProvider`, which feeds the result into
 * `CapabilitiesProvider`; every other consumer reads through
 * `useAuthorization()` / `useWebSession()`.
 *
 * Guests never call the endpoint and resolve to an empty capability set, so
 * every gated control denies without a 401 round-trip.
 *
 * The server-rendered answer seeds the query and stands in before the first
 * live answer ONLY on the session the server rendered for. After a sign-out
 * or another member's sign-in it belongs to a session that is gone: using it
 * would show the previous member's capabilities, and as `initialData` it
 * would recreate the query as fresh right after the sign-out cache clear.
 */
export function useSessionPermissionsQuery(initialSessionPermissions: Envelope<SessionPermissionsResponse> | undefined, isAuthenticated: boolean): SessionPermissionsState {
	const { api } = useAuth();
	const isServerRenderedSession = useIsServerRenderedSession();
	const serverEnvelope = isServerRenderedSession ? initialSessionPermissions : undefined;
	const serverPermissions = serverEnvelope?.data;

	const permissionsQuery = api.auth.permissions.useQuery(undefined, {
		retry: 1,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		refetchInterval: SESSION_PERMISSIONS_REFETCH_INTERVAL_MS,
		enabled: isAuthenticated,
		...initialDataOption(serverEnvelope),
	});

	const liveResponse = isAuthenticated ? permissionsQuery.data?.data : undefined;
	const preloaded = isAuthenticated ? serverPermissions : undefined;

	const capabilities = React.useMemo((): readonly CapabilitySlug[] => resolveSessionCapabilities(liveResponse, preloaded), [liveResponse, preloaded]);

	return {
		capabilities,
		session: liveResponse ?? preloaded,
		isResolved: !isAuthenticated || liveResponse !== undefined || preloaded !== undefined || permissionsQuery.isError,
	};
}
