import type { QueryClient } from "@tanstack/react-query";

import { useAuthStore } from "./auth-store";
import { AUTH_ME_QUERY_KEY, invalidateSessionAuth } from "./invalidate-session-auth";
import { toAuthUser } from "./map-auth-user";
import type { ApiClient } from "../api/use-api";
import type { ApiRouter } from "../api/endpoints";
import type { AuthUser } from "./auth-store";

/**
 * Rotates the httpOnly session after email verification so access tokens pick up
 * `isEmailVerified` / `sessionScope: full` from the database.
 */
export async function syncSessionAfterEmailVerification(api: ApiClient<ApiRouter>, login: (user: AuthUser) => void, queryClient: QueryClient): Promise<void> {
	try {
		await api.auth.refresh.mutate({});
	} catch {
		// Guest may open the verify link without an active session.
	}

	await invalidateSessionAuth(queryClient);

	try {
		const meResponse = await api.auth.me.fetchOrThrow(undefined);
		login(toAuthUser(meResponse.data));
		queryClient.setQueryData(AUTH_ME_QUERY_KEY, meResponse);
		return;
	} catch {
		const currentUser = useAuthStore.getState().user;
		if (currentUser !== null) {
			login({ ...currentUser, isEmailVerified: true });
		}
	}
}
