import type { QueryClient } from "@tanstack/react-query";

/** Query keys for session profile and RBAC payloads. */
export const AUTH_ME_QUERY_KEY: readonly ["auth", "me"] = ["auth", "me"];
export const AUTH_PERMISSIONS_QUERY_KEY: readonly ["auth", "permissions"] = ["auth", "permissions"];
/** Merchant portal membership + capability payload (`GET /merchant/me`). */
export const MERCHANT_ME_QUERY_KEY: readonly ["merchant", "me"] = ["merchant", "me"];

/**
 * Invalidate `/auth/me` and `/auth/permissions` after RBAC mutations or impersonation.
 * Also clears merchant membership cache so capability gates reflect the active identity.
 */
export async function invalidateSessionAuth(queryClient: QueryClient): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
	await queryClient.invalidateQueries({ queryKey: AUTH_PERMISSIONS_QUERY_KEY });
	await queryClient.resetQueries({ queryKey: MERCHANT_ME_QUERY_KEY });
}
