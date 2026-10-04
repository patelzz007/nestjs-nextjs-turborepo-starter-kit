"use client";

import { useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import type { Envelope, OwnProfile, UpdateOwnProfileInput } from "@workspace/shared";

import { initialDataOption } from "../../api/envelope";
import { useAuth } from "../index";
import { applyOwnProfileUpdated, applyOwnProfileUpdateFailed } from "./own-profile-cache";

/** `GET /auth/profile` — the signed-in user's own profile, seeded with a server-prefetched envelope when the page has one. */
export function useOwnProfile(initialProfile?: Envelope<OwnProfile>): UseQueryResult<Envelope<OwnProfile>> {
	const { api } = useAuth();
	return api.auth.profile.useQuery(undefined, initialDataOption(initialProfile));
}

export interface UseUpdateOwnProfileOptions {
	/** Runs after the cache holds the new profile (and `/auth/me` was refreshed). */
	readonly onSuccess?: (profile: OwnProfile) => void;
	/** Every failure — the caller surfaces it; a 409 has already triggered a reload of the profile. */
	readonly onError: (error: Error) => void;
}

/**
 * `PATCH /auth/profile`. On success the cached profile becomes the response and
 * `/auth/me` is refetched; on a stale `version` (409) the profile is reloaded
 * so the form can be edited again on top of the latest version.
 */
export function useUpdateOwnProfile(options: UseUpdateOwnProfileOptions): UseMutationResult<Envelope<OwnProfile>, Error, UpdateOwnProfileInput> {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	return api.auth.updateProfile.useMutation({
		onSuccess: async (response: Envelope<OwnProfile>): Promise<void> => {
			await applyOwnProfileUpdated(queryClient, response);
			options.onSuccess?.(response.data);
		},
		onError: async (error: Error): Promise<void> => {
			await applyOwnProfileUpdateFailed(queryClient, error);
			options.onError(error);
		},
	});
}
