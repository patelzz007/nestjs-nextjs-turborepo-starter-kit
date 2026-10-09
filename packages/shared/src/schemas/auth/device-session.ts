import { z } from "zod";

import { EpochMsSchema } from "../api/common";
import { DeviceTypeSchema } from "../domain/platform/enums";
import { UuidParamSchema } from "../domain/platform/param-schemas";
import { PlainMessageResponseSchema } from "../api/message";
import { AuthClientTypeSchema } from "./auth";

// ── Device sessions (docs/technical/mobile/mobile-app.md §8, ADR 034) ───────
//
// A device session is one signed-in device: the refresh-token row the device
// holds. Its details are captured at sign-in (and the last IP / activity on
// every refresh) and listed by `GET /auth/sessions`. Client-reported values
// (browser, OS, device model and name, app version) are DISPLAY-ONLY: they are
// length-limited and validated here before storage, rendered as plain text, and
// never influence authorization, rate limits or risk decisions.

/** Column budgets of `refresh_tokens` (prisma/schema.prisma `RefreshToken`). */
export const SESSION_BROWSER_NAME_MAX_LENGTH = 64;
export const SESSION_BROWSER_VERSION_MAX_LENGTH = 32;
export const SESSION_OS_NAME_MAX_LENGTH = 64;
export const SESSION_OS_VERSION_MAX_LENGTH = 32;
export const SESSION_DEVICE_MODEL_MAX_LENGTH = 64;
export const SESSION_DEVICE_NAME_MAX_LENGTH = 64;
export const SESSION_LOCATION_REGION_MAX_LENGTH = 64;
export const SESSION_LOCATION_CITY_MAX_LENGTH = 128;

/**
 * Characters a display string may not carry: C0/C1 control characters and the
 * bidirectional overrides / isolates (U+202A–U+202E, U+2066–U+2069), which can
 * make a device name render as something it is not. Emoji joiners stay allowed
 * (a phone may well be called "Alex’s 📱").
 */
const UNSAFE_DISPLAY_CHARACTER_PATTERN = /[\p{Cc}‪-‮⁦-⁩]/u;

/** A client-reported display string: trimmed, non-empty, at most `maxLength` characters, no control characters. */
export function sessionDisplayTextSchema(maxLength: number): z.ZodString {
	return z
		.string()
		.trim()
		.min(1)
		.max(maxLength)
		.refine((value: string): boolean => !UNSAFE_DISPLAY_CHARACTER_PATTERN.test(value), { error: "must not contain control characters" });
}

/** A device model as stored and shown (`iPhone 15 Pro`, `Pixel 8`). */
export const SessionDeviceModelSchema = sessionDisplayTextSchema(SESSION_DEVICE_MODEL_MAX_LENGTH);

/** A device's own name as stored and shown (`Alex’s iPhone`). */
export const SessionDeviceNameSchema = sessionDisplayTextSchema(SESSION_DEVICE_NAME_MAX_LENGTH);

/**
 * Upper bound of one percent-encoded device header value: every character of
 * the decoded value is at most four UTF-8 bytes, each encoded as `%XX`.
 */
const DEVICE_HEADER_ENCODED_MAX_LENGTH = SESSION_DEVICE_NAME_MAX_LENGTH * 4 * 3;

function isPercentDecodable(value: string): boolean {
	try {
		decodeURIComponent(value);
		return true;
	} catch {
		return false;
	}
}

/**
 * Percent-encodes a device detail for its header (`DEVICE_MODEL_HEADER` /
 * `DEVICE_NAME_HEADER`): HTTP header values are bytes, so a name such as
 * "Alex’s iPhone" travels as UTF-8 percent-encoding and the API decodes it.
 */
export function encodeSessionDeviceHeaderValue(value: string): string {
	return encodeURIComponent(value);
}

function sessionDeviceHeaderSchema(decoded: z.ZodString): z.ZodPipe<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>, z.ZodString> {
	return z
		.string()
		.max(DEVICE_HEADER_ENCODED_MAX_LENGTH)
		.refine(isPercentDecodable, { error: "must be percent-encoded UTF-8" })
		.transform((value: string): string => decodeURIComponent(value))
		.pipe(decoded);
}

/** `X-Device-Model` as received: percent-encoded, decoded, then validated as {@link SessionDeviceModelSchema}. */
export const SessionDeviceModelHeaderSchema = sessionDeviceHeaderSchema(SessionDeviceModelSchema);

/** `X-Device-Name` as received: percent-encoded, decoded, then validated as {@link SessionDeviceNameSchema}. */
export const SessionDeviceNameHeaderSchema = sessionDeviceHeaderSchema(SessionDeviceNameSchema);

/**
 * How a device session was signed in — the proofs the login flow required
 * (mirrors the Prisma enum `SessionSignInMethod`). The `_NEW_DEVICE_CODE`
 * variants add the emailed new-device code that login verification asks for.
 */
export const SessionSignInMethodSchema = z.enum([
	"PASSWORD",
	"PASSWORD_NEW_DEVICE_CODE",
	"PASSWORD_TOTP",
	"PASSWORD_TOTP_NEW_DEVICE_CODE",
	"PASSWORD_BACKUP_CODE",
	"PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE",
	"TEAM_INVITE_REGISTRATION",
	"TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE",
]);

export type SessionSignInMethod = z.output<typeof SessionSignInMethodSchema>;

/**
 * Who revoked a session when no user did (the `deletedBy` of a session row). A
 * closed set — a free-form string is rejected:
 * - `system:rotation-reuse` — a rotated refresh token was replayed; every session of the user was revoked;
 * - `system:logout-all` — a system-initiated sign-out of every device (a completed password reset);
 * - `system:expired-cleanup` — the sweep at sign-in retired a session past its expiry;
 * - `system:session-limit` — the sweep at sign-in retired the oldest sessions above the per-user cap;
 * - `system:rbac-mutation` — a scheduled authorization change (an expired temporary permission) signed the user out.
 */
export const SessionSystemRevokerSchema = z.enum(["system:rotation-reuse", "system:logout-all", "system:expired-cleanup", "system:session-limit", "system:rbac-mutation"]);

export type SessionSystemRevoker = z.output<typeof SessionSystemRevokerSchema>;

/** The `deletedBy` of a revoked session: the id of the user who revoked it (the owner or an admin), or a system marker. */
export const SessionRevokedBySchema = z.union([UuidParamSchema, SessionSystemRevokerSchema]);

export type SessionRevokedBy = z.output<typeof SessionRevokedBySchema>;

/** Where a session signed in from (the `SessionLocationResolver` port); `null` on a session while no provider is configured. */
export const SessionLocationSchema = z.object({
	/** ISO 3166-1 alpha-2. */
	country: z
		.string()
		.regex(/^[A-Z]{2}$/)
		.meta({ description: "ISO 3166-1 alpha-2 country", example: "MY" }),
	region: sessionDisplayTextSchema(SESSION_LOCATION_REGION_MAX_LENGTH).nullable().meta({ example: "Selangor" }),
	city: sessionDisplayTextSchema(SESSION_LOCATION_CITY_MAX_LENGTH).nullable().meta({ example: "Petaling Jaya" }),
});

export type SessionLocation = z.output<typeof SessionLocationSchema>;

/**
 * One device session of the caller (`GET /auth/sessions`). Fields stored
 * before device details existed are `null`; clients hide what is `null`.
 */
export const SessionSchema = z.object({
	id: z.string().meta({ description: "The session id — the `sid` of its access tokens" }),
	label: z.string().meta({ description: "Display name built by the server from the device details", example: "Chrome 141 on macOS" }),
	isCurrent: z.boolean().meta({ description: "This request's own session (from the access token's `sid`)" }),
	clientType: AuthClientTypeSchema.nullable(),
	browserName: z.string().nullable().meta({ example: "Chrome" }),
	browserVersion: z.string().nullable().meta({ example: "141.0.0.0" }),
	osName: z.string().nullable().meta({ example: "macOS" }),
	osVersion: z.string().nullable().meta({ example: "16.1" }),
	deviceType: DeviceTypeSchema.nullable(),
	deviceModel: z.string().nullable().meta({ example: "iPhone 15 Pro" }),
	deviceName: z.string().nullable().meta({ example: "Alex’s iPhone" }),
	appVersion: z.string().nullable().meta({ description: "Mobile app version", example: "1.4.0" }),
	signInMethod: SessionSignInMethodSchema.nullable(),
	ipAddress: z.string().nullable().meta({ description: "IP at sign-in", example: "203.0.113.24" }),
	lastIpAddress: z.string().nullable().meta({ description: "IP of the most recent refresh", example: "198.51.100.7" }),
	location: SessionLocationSchema.nullable(),
	createdAt: EpochMsSchema,
	lastActiveAt: EpochMsSchema,
	expiresAt: EpochMsSchema,
});

export type Session = z.output<typeof SessionSchema>;

/** `GET /auth/sessions` — the caller's active sessions: the current one first, then by last activity (newest first). */
export const SessionListResponseSchema = z.array(SessionSchema);

export type SessionListResponse = z.output<typeof SessionListResponseSchema>;

/** `POST /auth/sessions/:sessionId/revoke` route input. */
export const RevokeSessionInputSchema = z
	.object({
		sessionId: UuidParamSchema.meta({ description: "The session to revoke (one of the caller's own)" }),
	})
	.strict();

export type RevokeSessionInput = z.output<typeof RevokeSessionInputSchema>;

/** `POST /auth/sessions/:sessionId/revoke` result. */
export const RevokeSessionResponseSchema = PlainMessageResponseSchema.extend({
	/** `true` when the revoked session was the caller's own: it is signed out (a browser's auth cookies are cleared). */
	revokedCurrentSession: z.boolean(),
});

export type RevokeSessionResponse = z.output<typeof RevokeSessionResponseSchema>;

/**
 * Stable error codes of the device-session endpoints, besides the standard ones:
 * - `SESSION_NOT_FOUND` (404): no session with that id belongs to the caller —
 *   never 403, so an id of someone else's session is not confirmed to exist;
 * - `SESSION_REVOKE_DURING_IMPERSONATION` (403): an impersonation session may
 *   list the user's devices but never sign one out (the revocation would be
 *   recorded as the user's own).
 */
export const DeviceSessionErrorCodeSchema = z.enum(["SESSION_NOT_FOUND", "SESSION_REVOKE_DURING_IMPERSONATION"]);

export type DeviceSessionErrorCode = z.output<typeof DeviceSessionErrorCodeSchema>;

export const DEVICE_SESSION_ERROR_CODES: Readonly<Record<DeviceSessionErrorCode, DeviceSessionErrorCode>> = DeviceSessionErrorCodeSchema.enum;
