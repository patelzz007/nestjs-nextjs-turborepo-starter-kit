"use client";

import type { ImageSource } from "@workspace/shared";

import { useAuth } from "../index";

/**
 * The signed-in person's profile picture, for the app shell (sidebar account,
 * profile menu): its URL and renditions, or `null` (initials are shown).
 *
 * Read from `GET /auth/profile` — the same query the profile editors use, so a
 * new or removed picture (which reloads that query) shows in the shell at once
 * and after a refresh. Only a full session asks: a restricted one (email or
 * two-factor setup pending) may not read the profile, and shows initials.
 */
/** A profile picture as the shell draws it: its URL and its renditions, smallest first. */
export interface OwnAvatarImage {
	readonly url: string;
	readonly sources: ImageSource[];
}

export function useOwnAvatar(): OwnAvatarImage | null {
	const { api, user } = useAuth();
	const profileQuery = api.auth.profile.useQuery(undefined, { enabled: user?.sessionScope === "full" });
	const avatar = profileQuery.data?.data.avatar ?? null;
	return avatar === null ? null : { url: avatar.url, sources: avatar.sources };
}
