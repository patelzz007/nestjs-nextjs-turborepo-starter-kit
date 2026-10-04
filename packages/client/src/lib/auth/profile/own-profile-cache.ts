import type { QueryClient } from "@tanstack/react-query";
import { ApiErrorCodes, type Envelope, type OwnProfile } from "@workspace/shared";

import { ApiError } from "../../api/api-request";
import { apiRouter } from "../../api/endpoints";

// ============================================
// lib/auth/profile/own-profile-cache.ts — cache effects of a profile edit
// ============================================
// Pure (no hooks), so every app's hook and every test share ONE definition of
// what a successful or failed `PATCH /auth/profile` does to the query cache.
// Keys come from the endpoint registry, never written by hand.

/** True when the API refused the edit because the profile changed since it was read (optimistic lock, 409 CONFLICT). */
export function isStaleProfileVersionError(error: Error): boolean {
	return error instanceof ApiError && error.code === ApiErrorCodes.CONFLICT;
}

/**
 * After a successful edit: the response IS the new profile (with its new
 * `version`), so it replaces the cached one; `/auth/me` carries the name too
 * (topbar, menus) and is refetched.
 */
export async function applyOwnProfileUpdated(queryClient: QueryClient, response: Envelope<OwnProfile>): Promise<void> {
	queryClient.setQueryData(apiRouter.auth.profile.queryKey(undefined), response, { updatedAt: response.meta.timestamp });
	await queryClient.invalidateQueries({ queryKey: apiRouter.auth.me.scopeKey(undefined) });
}

/** After a stale-version refusal: reload the profile so the next edit is based on the current version. */
export async function applyOwnProfileUpdateFailed(queryClient: QueryClient, error: Error): Promise<void> {
	if (isStaleProfileVersionError(error)) {
		await queryClient.invalidateQueries({ queryKey: apiRouter.auth.profile.scopeKey(undefined) });
	}
}
