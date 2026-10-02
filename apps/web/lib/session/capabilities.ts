"use client";

import { useAuth } from "@workspace/client/lib/auth";
import type { CapabilitySlug, SessionPermissionsResponse } from "@workspace/shared";
import * as React from "react";

import { initialDataOption, stubApiMeta, successEnvelope } from "@workspace/client/lib/api/envelope";

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
 */
export function useSessionPermissionsQuery(initialSessionPermissions: SessionPermissionsResponse | undefined, isAuthenticated: boolean): SessionPermissionsState {
	const { api } = useAuth();

	const initialPermissionsData = React.useMemo(
		() => (initialSessionPermissions !== undefined ? successEnvelope(initialSessionPermissions, stubApiMeta()) : undefined),
		[initialSessionPermissions],
	);

	const permissionsQuery = api.auth.permissions.useQuery(undefined, {
		retry: 1,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		refetchInterval: SESSION_PERMISSIONS_REFETCH_INTERVAL_MS,
		enabled: isAuthenticated,
		...initialDataOption(initialPermissionsData),
	});

	const liveResponse = isAuthenticated ? permissionsQuery.data?.data : undefined;
	const preloaded = isAuthenticated ? initialSessionPermissions : undefined;

	const capabilities = React.useMemo((): readonly CapabilitySlug[] => resolveSessionCapabilities(liveResponse, preloaded), [liveResponse, preloaded]);

	return {
		capabilities,
		session: liveResponse ?? preloaded,
		isResolved: !isAuthenticated || liveResponse !== undefined || preloaded !== undefined || permissionsQuery.isError,
	};
}
