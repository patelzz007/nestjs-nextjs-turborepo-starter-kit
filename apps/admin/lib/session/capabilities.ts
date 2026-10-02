"use client";

import { useAuth } from "@workspace/client/lib/auth";
import type { CapabilitySlug, SessionPermissionsResponse } from "@workspace/shared";
import * as React from "react";

import { initialDataOption, stubApiMeta, successEnvelope } from "@workspace/client/lib/api/envelope";

/** Re-checks revocations promptly without hammering the API. */
export const SESSION_PERMISSIONS_REFETCH_INTERVAL_MS = 60_000;

export interface SessionPermissionsState {
	/** Capability slugs fed into `CapabilitiesProvider` — the single client source of truth. */
	readonly capabilities: readonly CapabilitySlug[];
	/** True once there is a permissions answer (live, preloaded, or a definitive error). */
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
	return preloaded?.capabilities ?? [];
}

/**
 * Owns `GET /auth/permissions` for the admin panel. Mounted once by
 * `DashboardLayout`, which feeds the result into `CapabilitiesProvider`;
 * every other consumer reads through `useAuthorization()`.
 */
export function useSessionPermissionsQuery(initialSessionPermissions?: SessionPermissionsResponse): SessionPermissionsState {
	const { api } = useAuth();

	const permissionsQuery = api.auth.permissions.useQuery(undefined, {
		retry: 1,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		refetchInterval: SESSION_PERMISSIONS_REFETCH_INTERVAL_MS,
		...initialDataOption(initialSessionPermissions !== undefined ? successEnvelope(initialSessionPermissions, stubApiMeta()) : undefined),
	});

	const liveResponse = permissionsQuery.data?.data;
	const capabilities = React.useMemo(
		(): readonly CapabilitySlug[] => resolveSessionCapabilities(liveResponse, initialSessionPermissions),
		[liveResponse, initialSessionPermissions],
	);

	return {
		capabilities,
		isResolved: liveResponse !== undefined || initialSessionPermissions !== undefined || permissionsQuery.isError,
	};
}
