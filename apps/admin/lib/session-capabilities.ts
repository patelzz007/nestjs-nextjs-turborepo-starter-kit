"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { hasCapability, type CapabilitySlug, type SessionPermissionsResponse } from "@workspace/shared";
import * as React from "react";

import { stubApiMeta } from "@/lib/api-envelope";

export interface SessionCapabilitiesState {
	readonly capabilities: readonly CapabilitySlug[];
	readonly hasCapability: (slug: CapabilitySlug) => boolean;
	readonly isLoading: boolean;
	readonly isReady: boolean;
}

/** Platform capability slugs from `GET /auth/permissions` (admin + impersonation flows). */
export function useSessionCapabilities(initialSessionPermissions?: SessionPermissionsResponse): SessionCapabilitiesState {
	const { api } = useAuth();

	const initialPermissionsData = React.useMemo(
		() =>
			initialSessionPermissions !== undefined
				? {
						success: true as const,
						data: initialSessionPermissions,
						meta: stubApiMeta(),
					}
				: undefined,
		[initialSessionPermissions],
	);

	const permissionsQuery = api.auth.permissions.useQuery(undefined, {
		retry: 1,
		staleTime: 30_000,
		initialData: initialPermissionsData,
	});

	const capabilities = React.useMemo((): readonly CapabilitySlug[] => permissionsQuery.data?.data?.capabilities ?? [], [permissionsQuery.data?.data?.capabilities]);

	const checkCapability = React.useCallback((slug: CapabilitySlug): boolean => hasCapability(capabilities, slug), [capabilities]);

	const isLoading = permissionsQuery.isPending && permissionsQuery.data === undefined;
	const isReady = permissionsQuery.data !== undefined;

	return {
		capabilities,
		hasCapability: checkCapability,
		isLoading,
		isReady,
	};
}
