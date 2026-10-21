"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { CapabilitySlug, Envelope, SessionPermissionsResponse } from "@workspace/shared";
import * as React from "react";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { resolveSessionCapabilities, SESSION_PERMISSIONS_QUERY_OPTIONS } from "@workspace/client/lib/contexts/authorization/session-permissions";

export { SESSION_PERMISSIONS_REFETCH_INTERVAL_MS } from "@workspace/client/lib/contexts/authorization/session-permissions";

/**
 * Whether the session's permissions are known:
 * - `loading` — no answer yet (first fetch in flight, nothing preloaded);
 * - `ready` — a live or server-preloaded answer exists;
 * - `failed` — the first fetch failed and nothing was preloaded. This is NOT
 *   "no permissions": the guard must say the permissions could not be loaded
 *   and offer a retry, never render "access denied" for a network failure.
 */
export type SessionPermissionsStatus = "loading" | "ready" | "failed";

export interface SessionPermissionsState {
	/** Capability slugs fed into `CapabilitiesProvider` — the single client source of truth. */
	readonly capabilities: readonly CapabilitySlug[];
	readonly status: SessionPermissionsStatus;
	/** Refetches `GET /auth/permissions` (the retry of the `failed` state). */
	readonly retry: () => void;
}

/** The status for what the query has: any answer wins over an error; an error without one is a failure. */
export function resolveSessionPermissionsStatus(hasLiveAnswer: boolean, hasPreloadedAnswer: boolean, isError: boolean): SessionPermissionsStatus {
	if (hasLiveAnswer || hasPreloadedAnswer) {
		return "ready";
	}
	return isError ? "failed" : "loading";
}

/**
 * Owns `GET /auth/permissions` for the admin panel. Mounted once by
 * `DashboardLayout`, which feeds the result into `CapabilitiesProvider`;
 * every other consumer reads through `useAuthorization()`.
 */
export function useSessionPermissionsQuery(initialSessionPermissions?: Envelope<SessionPermissionsResponse>): SessionPermissionsState {
	const { api } = useAuth();

	const permissionsQuery = api.auth.permissions.useQuery(undefined, {
		...SESSION_PERMISSIONS_QUERY_OPTIONS,
		...initialDataOption(initialSessionPermissions),
	});

	const liveResponse = permissionsQuery.data?.data;
	const capabilities = React.useMemo(
		(): readonly CapabilitySlug[] => resolveSessionCapabilities(liveResponse, initialSessionPermissions?.data),
		[liveResponse, initialSessionPermissions],
	);

	const { refetch } = permissionsQuery;
	const retry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	return {
		capabilities,
		status: resolveSessionPermissionsStatus(liveResponse !== undefined, initialSessionPermissions !== undefined, permissionsQuery.isError),
		retry,
	};
}
