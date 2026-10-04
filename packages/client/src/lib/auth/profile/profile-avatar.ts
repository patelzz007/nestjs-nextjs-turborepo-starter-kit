import type { QueryClient } from "@tanstack/react-query";
import { FILE_CATEGORY_POLICIES, ImageMimeTypeSchema, type DocumentMimeType, type FileCategoryPolicy, type ImageMimeType } from "@workspace/shared";

import { apiRouter } from "../../api/endpoints";

// ============================================
// lib/auth/profile/profile-avatar.ts — avatar rules shared by every app
// ============================================
// The avatar is a `USER_AVATAR` stored file (POST /files/upload-url → upload →
// POST /files/:id/complete → scan → bound to the user). Its limits come from the
// shared file-category contract — the same ones the API enforces.

/** The upload policy of avatars (size + MIME allowlist), from the shared contract. */
export const AVATAR_FILE_POLICY: FileCategoryPolicy = FILE_CATEGORY_POLICIES.USER_AVATAR;

/** Bytes per mebibyte — for the human-readable size limit. */
const BYTES_PER_MEBIBYTE = 1_048_576;

/** The `accept` attribute of an avatar file input. */
export const AVATAR_ACCEPT: string = AVATAR_FILE_POLICY.allowedMimeTypes.join(",");

/** The largest avatar, in whole MiB, for messages. */
export const AVATAR_MAX_MEBIBYTES: number = Math.floor(AVATAR_FILE_POLICY.maxBytes / BYTES_PER_MEBIBYTE);

export type AvatarFileRejection = "unsupported_type" | "too_large" | "empty";

/** The picked file cannot be an avatar — rejected before anything is uploaded. */
export class AvatarFileRejectedError extends Error {
	public readonly reason: AvatarFileRejection;

	public constructor(reason: AvatarFileRejection, message: string) {
		super(message);
		this.name = "AvatarFileRejectedError";
		this.reason = reason;
	}
}

function isAllowedAvatarType(mimeType: ImageMimeType): boolean {
	return AVATAR_FILE_POLICY.allowedMimeTypes.some((allowed: DocumentMimeType): boolean => allowed === mimeType);
}

/** Checks a picked file against the avatar policy (UX — the API re-checks size, type and magic bytes). */
export function assertAvatarFileAllowed(file: File): void {
	const type = ImageMimeTypeSchema.safeParse(file.type);
	if (!type.success || !isAllowedAvatarType(type.data)) {
		throw new AvatarFileRejectedError("unsupported_type", "Choose a JPEG, PNG, WebP or AVIF image.");
	}
	if (file.size === 0) {
		throw new AvatarFileRejectedError("empty", "The chosen file is empty.");
	}
	if (file.size > AVATAR_FILE_POLICY.maxBytes) {
		throw new AvatarFileRejectedError("too_large", `The image must be at most ${String(AVATAR_MAX_MEBIBYTES)} MB.`);
	}
}

/** After the avatar changed (bound or deleted): reload the profile, which reports the live avatar. */
export async function refreshProfileAfterAvatarChange(queryClient: QueryClient): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: apiRouter.auth.profile.scopeKey(undefined) });
}
