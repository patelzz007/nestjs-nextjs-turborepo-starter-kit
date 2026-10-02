import type { QueryClient } from "@tanstack/react-query";
import type { SessionPermissionsResponse, UserResponse } from "@workspace/shared";

import { apiRouter } from "../../api/endpoints";
import { stubApiMeta, successEnvelope } from "../../api/envelope";
import type { AuthQueryCache } from "../../features/auth/effects";

/**
 * The auth feature's view of a QueryClient: seeds the session queries with
 * answers the server already returned, and clears everything on sign-out.
 * Keys come from the endpoint registry, so they always match
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
		seedProfile: (profile: UserResponse): void => {
			queryClient.setQueryData(meDef.queryKey(undefined), successEnvelope(profile, stubApiMeta()));
		},
		seedSessionPermissions: (permissions: SessionPermissionsResponse): void => {
			queryClient.setQueryData(permissionsDef.queryKey(undefined), successEnvelope(permissions, stubApiMeta()));
		},
		dropSessionPermissions: (): void => {
			queryClient.removeQueries({ queryKey: permissionsDef.queryKey(undefined), exact: true });
		},
		markEmailVerified: (): void => {
			const key = meDef.queryKey(undefined);
			// The cache is untyped storage: read it back through the endpoint's own response schema.
			const cached = meDef.responseSchema.safeParse(queryClient.getQueryData(key));
			if (!cached.success) {
				return;
			}
			queryClient.setQueryData(key, { ...cached.data, data: { ...cached.data.data, isEmailVerified: true } });
		},
		clear: (): void => {
			// Aborts every in-flight fetch now (the cancellation itself is synchronous),
			// then drops all queries and mutations — before the caller's next step.
			void queryClient.cancelQueries();
			queryClient.clear();
		},
	};
}
