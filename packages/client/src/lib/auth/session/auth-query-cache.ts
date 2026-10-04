import type { QueryClient } from "@tanstack/react-query";
import type { Envelope, SessionPermissionsResponse, UserResponse } from "@workspace/shared";

import { apiRouter } from "../../api/endpoints";
import type { AuthQueryCache } from "../../features/auth/effects";

/**
 * The auth feature's view of a QueryClient: seeds the session queries with
 * answers the server already returned — the whole envelope, real `meta`
 * included, stamped with the server's answer time so staleness is measured
 * from when the server answered — and clears everything on sign-out. Keys
 * come from the endpoint registry, so they always match
 * `api.auth.me.useQuery()` / `api.auth.permissions.useQuery()`.
 */
export function createAuthQueryCache(queryClient: QueryClient): AuthQueryCache {
	const meDef = apiRouter.auth.me;
	const permissionsDef = apiRouter.auth.permissions;

	return {
		readProfileId: (): string | null => {
			// The cache is untyped storage: read it back through the endpoint's own response schema.
			const cached = meDef.responseSchema.safeParse(queryClient.getQueryData(meDef.queryKey(undefined)));
			return cached.success ? cached.data.data.id : null;
		},
		seedProfile: (profile: Envelope<UserResponse>): void => {
			queryClient.setQueryData(meDef.queryKey(undefined), profile, { updatedAt: profile.meta.timestamp });
		},
		seedSessionPermissions: (permissions: Envelope<SessionPermissionsResponse>): void => {
			queryClient.setQueryData(permissionsDef.queryKey(undefined), permissions, { updatedAt: permissions.meta.timestamp });
		},
		dropSessionPermissions: (): void => {
			queryClient.removeQueries({ queryKey: permissionsDef.queryKey(undefined), exact: true });
		},
		clear: (): void => {
			// Aborts every in-flight fetch now (the cancellation itself is synchronous),
			// then drops all queries and mutations — before the caller's next step.
			void queryClient.cancelQueries();
			queryClient.clear();
		},
	};
}
