import type { QueryClient } from "@tanstack/react-query";

import { useAuthStore } from "../session/store";
import { AUTH_ME_QUERY_KEY, invalidateSessionAuth } from "../session/invalidate-auth";
import { toAuthUser } from "../session/map-auth-user";
import type { ApiClient } from "../../api/use-api";
import type { ApiRouter } from "../../api/endpoints";
import type { AuthUser } from "../session/store";

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
		const [meResponse, permissionsResponse] = await Promise.all([api.auth.me.fetchOrThrow(undefined), api.auth.permissions.fetchOrThrow(undefined)]);
		login(toAuthUser(meResponse.data, permissionsResponse.data));
		queryClient.setQueryData(AUTH_ME_QUERY_KEY, meResponse);
		return;
	} catch {
		const currentUser = useAuthStore.getState().user;
		if (currentUser !== null) {
			login({
				...currentUser,
				isEmailVerified: true,
				sessionScope: currentUser.enrollmentReason === "mfa_enrollment" ? "restricted" : "full",
				enrollmentReason: currentUser.enrollmentReason === "mfa_enrollment" ? "mfa_enrollment" : null,
			});
		}
	}
}
