import type { QueryClient } from "@tanstack/react-query";

/** Query keys for session profile and RBAC payloads. */
export const AUTH_ME_QUERY_KEY: readonly ["auth", "me"] = ["auth", "me"];
export const AUTH_PERMISSIONS_QUERY_KEY: readonly ["auth", "permissions"] = ["auth", "permissions"];

/**
 * Invalidate `/auth/me` and `/auth/permissions` after RBAC mutations or impersonation.
 */
export async function invalidateSessionAuth(queryClient: QueryClient): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY });
	await queryClient.invalidateQueries({ queryKey: AUTH_PERMISSIONS_QUERY_KEY });
}
