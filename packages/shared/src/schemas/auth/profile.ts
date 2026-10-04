import { z } from "zod";

import { EpochMsSchema } from "../api/common";
import { OptimisticVersionSchema } from "../domain/catalog/catalog-fields";

// ── Own profile (self-service) ─────────────────────────────────────────────
//
// `GET /auth/profile` and `PATCH /auth/profile`: the signed-in user reads and
// edits THEIR OWN profile. Every app (admin, merchant, web) uses these schemas
// for its form, and the API validates the very same ones at its boundary.
//
// The avatar is deliberately not a field of the update: it is uploaded through
// the file pipeline (`POST /files/upload-url` with `category: "USER_AVATAR"`,
// then `POST /files/:fileId/complete`), bound to the user when its malware scan
// passes, and removed with `DELETE /files/:fileId`. The profile only reports
// the live avatar.

/** Shortest accepted full name — the same floor signup enforces. */
export const USER_FULL_NAME_MIN_LENGTH = 2;

/** Longest accepted full name — sizes the `users.full_name` column (`VarChar(100)`). */
export const USER_FULL_NAME_MAX_LENGTH = 100;

/** No ASCII/Unicode control characters (newlines, tabs, NUL …) inside a display name. */
const NO_CONTROL_CHARACTERS_PATTERN = /^[^\p{Cc}]*$/u;

/**
 * A person's display name: surrounding whitespace is trimmed, then it must be
 * {@link USER_FULL_NAME_MIN_LENGTH}–{@link USER_FULL_NAME_MAX_LENGTH} characters
 * with no control characters.
 */
export const UserFullNameSchema = z
	.string()
	.trim()
	.pipe(
		z
			.string()
			.min(USER_FULL_NAME_MIN_LENGTH, `Full name must be at least ${String(USER_FULL_NAME_MIN_LENGTH)} characters`)
			.max(USER_FULL_NAME_MAX_LENGTH, `Full name must be at most ${String(USER_FULL_NAME_MAX_LENGTH)} characters`)
			.regex(NO_CONTROL_CHARACTERS_PATTERN, "Full name cannot contain line breaks or other control characters"),
	)
	.meta({ description: "The user's full name (trimmed)", example: "Jane Doe" });

/**
 * The fields a user may change on their own profile — one entry per editable
 * field. A form edits exactly these, and {@link UpdateOwnProfileSchema} is
 * derived from them, so adding a field here is the whole contract change.
 */
export const OwnProfileEditableFieldsSchema = z
	.object({
		fullName: UserFullNameSchema,
	})
	.strict();

export type OwnProfileEditableFields = z.output<typeof OwnProfileEditableFieldsSchema>;

/** The editable field names, from the schema itself. */
export const OWN_PROFILE_EDITABLE_FIELDS: readonly (keyof OwnProfileEditableFields)[] = OwnProfileEditableFieldsSchema.keyof().options;

/**
 * `PATCH /auth/profile` body — any non-empty subset of the editable fields,
 * plus the profile `version` the client read (optimistic locking, rules/08 →
 * "Race conditions", option B). The update applies only while the stored
 * profile is still at that version; otherwise the API answers 409 CONFLICT and
 * the client reloads and retries. Unknown keys (`email`, `isSuperAdmin`, …)
 * are rejected, never silently dropped.
 */
export const UpdateOwnProfileSchema = OwnProfileEditableFieldsSchema.partial()
	.extend({
		version: OptimisticVersionSchema.meta({ description: "The profile `version` this edit is based on (optimistic lock)", example: 3 }),
	})
	.strict()
	.refine((input): boolean => OWN_PROFILE_EDITABLE_FIELDS.some((field): boolean => input[field] !== undefined), {
		message: "Send at least one profile field to change",
	});

export type UpdateOwnProfileInput = z.output<typeof UpdateOwnProfileSchema>;

/** The live avatar of a profile: the scanned, READY `USER_AVATAR` file bound to the user. */
export const OwnProfileAvatarSchema = z
	.object({
		fileId: z.uuid().meta({ description: "The stored file (`GET /files/:fileId`, `DELETE /files/:fileId`)" }),
		url: z.url().meta({ description: "Public URL of the avatar image" }),
		updatedAt: EpochMsSchema.meta({ description: "When this avatar was bound to the profile (epoch ms)" }),
	})
	.meta({ description: "The profile's current avatar. Response schema: unknown keys are stripped, never rejected (ADR 022)." });

export type OwnProfileAvatar = z.output<typeof OwnProfileAvatarSchema>;

/** `GET /auth/profile` / `PATCH /auth/profile` payload — the signed-in user's own profile. */
export const OwnProfileSchema = z
	.object({
		id: z.uuid(),
		email: z.string().meta({ description: "Sign-in email (read-only here)" }),
		fullName: z.string(),
		avatar: OwnProfileAvatarSchema.nullable().meta({ description: "The live avatar, or null when the user has none" }),
		version: OptimisticVersionSchema.meta({ description: "Optimistic-lock token: send it back with `PATCH /auth/profile`", example: 3 }),
		createdAt: EpochMsSchema,
		updatedAt: EpochMsSchema,
	})
	.meta({ description: "The signed-in user's own profile. Response schema: unknown keys are stripped, never rejected (ADR 022)." });

export type OwnProfile = z.output<typeof OwnProfileSchema>;

/**
 * Stable error codes of the own-profile endpoints, besides the standard ones
 * (`VALIDATION_ERROR`, `CONFLICT` for a stale `version`, `UNAUTHORIZED`, …).
 * - `PROFILE_UPDATE_DURING_IMPERSONATION` (403): an impersonation session may
 *   read the profile but never change it — the identity it shows is the
 *   impersonated user's own.
 */
export const OwnProfileErrorCodeSchema = z.enum(["PROFILE_UPDATE_DURING_IMPERSONATION"]);

export type OwnProfileErrorCode = z.output<typeof OwnProfileErrorCodeSchema>;

export const OWN_PROFILE_ERROR_CODES: Readonly<Record<OwnProfileErrorCode, OwnProfileErrorCode>> = OwnProfileErrorCodeSchema.enum;
