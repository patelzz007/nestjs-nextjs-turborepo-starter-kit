import type { QueryClient } from "@tanstack/react-query";
import { FILE_CATEGORY_POLICIES, type FileCategoryPolicy } from "@workspace/shared";

import { apiRouter } from "../../api/endpoints";
import { assertImageFileAllowed, ImageFileRejectedError, imageFileRules, type ImageFileRejection } from "../../storage/image-file-rules";

// ============================================
// lib/auth/profile/profile-avatar.ts — avatar rules shared by every app
// ============================================
// The avatar is a `USER_AVATAR` stored file (POST /files/upload-url → upload →
// POST /files/:id/complete → scan → bound to the user). Its limits come from the
// shared file-category contract — the same ones the API enforces.

/** The upload policy of avatars (size + MIME allowlist), from the shared contract. */
export const AVATAR_FILE_POLICY: FileCategoryPolicy = FILE_CATEGORY_POLICIES.USER_AVATAR;

const AVATAR_FILE_RULES = imageFileRules(AVATAR_FILE_POLICY);

/** The `accept` attribute of an avatar file input. */
export const AVATAR_ACCEPT: string = AVATAR_FILE_RULES.accept;

/** The largest avatar, in whole MiB, for messages. */
export const AVATAR_MAX_MEBIBYTES: number = AVATAR_FILE_RULES.maxMebibytes;

/** Why a picked file cannot be an avatar (the generic image rejection). */
export type AvatarFileRejection = ImageFileRejection;

/** The picked file cannot be an avatar — rejected before anything is uploaded (the generic image rejection). */
export { ImageFileRejectedError as AvatarFileRejectedError };

/** Checks a picked file against the avatar policy (UX — the API re-checks size, type and magic bytes). */
export function assertAvatarFileAllowed(file: File): void {
	assertImageFileAllowed(file, AVATAR_FILE_POLICY);
}

/** After the avatar changed (bound or deleted): reload the profile, which reports the live avatar. */
export async function refreshProfileAfterAvatarChange(queryClient: QueryClient): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: apiRouter.auth.profile.scopeKey(undefined) });
}
