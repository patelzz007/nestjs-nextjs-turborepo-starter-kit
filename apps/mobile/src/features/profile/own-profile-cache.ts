// What a profile edit does to the query cache — the same rules as the web
// (packages/client/src/lib/auth/profile/own-profile-cache.ts), which mobile
// cannot import. Keys come from the endpoint registry, never written by hand.

import { ApiError, apiRouter } from "@workspace/api-client";
import { ApiErrorCodes, type Envelope, type OwnProfile } from "@workspace/shared";
import type { QueryClient } from "@tanstack/react-query";

/** The API refused the edit because the profile changed since it was read (optimistic lock, 409 CONFLICT). */
export function isStaleProfileVersionError(error: Error): boolean {
	return error instanceof ApiError && error.code === ApiErrorCodes.CONFLICT;
}

/** After a successful edit: the response is the new profile; `/auth/me` carries the name too and is refetched. */
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

export const STALE_PROFILE_MESSAGE = "Your profile changed on another device. We loaded the latest version — please make your change again.";
