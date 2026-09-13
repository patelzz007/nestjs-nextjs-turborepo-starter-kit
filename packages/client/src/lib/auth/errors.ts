// ============================================
// lib/auth-errors.ts - Auth error-code mapping (i18n-ready)
// ============================================
// Maps the canonical API error codes (see AuthErrorCodeSchema in the shared
// package) to friendly, human-readable messages. Structured so adding a locale
// later is a single new catalog object — no code changes in callers.
//
// The API ALSO sends a raw `message` string, but it's server copy (and can be
// technical / inconsistent). This catalog is the single place the apps own the
// wording, keyed by the stable code.

import { ApiErrorBodySchema, AuthErrorCodeSchema, EpochMsSchema, LockedErrorCodeSchema, type EpochMs } from "@workspace/shared";
import { z } from "zod";

import { ApiError } from "../api/use-api";

// ── Locale plumbing ──────────────────────────────────────────────────────
// A new locale = one more entry in this record. The resolver takes a locale
// param (default "en") so nothing downstream needs to change to go multilingual.

export const LocaleSchema = z.enum(["en"]);

export type Locale = z.output<typeof LocaleSchema>;

/** One locale's message catalog — one friendly string per canonical code. */
export const AuthMessageCatalogSchema = z.record(AuthErrorCodeSchema, z.string());

export type AuthMessageCatalog = z.output<typeof AuthMessageCatalogSchema>;

const EN_MESSAGES: AuthMessageCatalog = {
	INVALID_CREDENTIALS: "Incorrect email or password. Please try again.",
	ACCOUNT_LOCKED: "Account temporarily locked due to too many failed attempts.",
	ADMIN_ACCESS_REQUIRED: "This account doesn't have admin panel access.",
	EMAIL_NOT_VERIFIED: "Please verify your email address before continuing.",
	ACCESS_TOKEN_MISSING: "Your session is missing an access token. Please log in again.",
	ACCESS_TOKEN_INVALID: "Your session is invalid. Please log in again.",
	ACCESS_TOKEN_EXPIRED: "Your session has expired. Please log in again.",
	REFRESH_TOKEN_MISSING: "Your session is missing a refresh token. Please log in again.",
	REFRESH_TOKEN_INVALID: "Your session is no longer valid. Please log in again.",
	REFRESH_TOKEN_EXPIRED: "Your session has expired. Please log in again.",
	TOKEN_THEFT_DETECTED: "Suspicious activity was detected. All sessions were signed out for your safety.",
	USER_NOT_FOUND: "This account no longer exists. Please contact support.",
	ACCOUNT_IS_INACTIVE: "This account is inactive. Please contact support.",
	ACCOUNT_DELETED: "This account has been deleted. Please contact support.",
	SUPER_ADMIN_REQUIRED: "Super administrator access is required for this action.",
};

/** All available catalogs, keyed by locale. Adding `fr` = one more line here. */
export const AUTH_MESSAGE_CATALOGS: Readonly<Record<Locale, AuthMessageCatalog>> = {
	en: EN_MESSAGES,
};

export const DEFAULT_LOCALE: Locale = "en";

/** Fallback used when an error has no code at all (network / generic failures). */
const GENERIC_MESSAGE = "Something went wrong. Please try again.";

const NonEmptyStringSchema = z.string().min(1);

const ErrorWithMessageSchema = z.object({
	message: NonEmptyStringSchema,
});

/** Full lockout payload on an `ACCOUNT_LOCKED` response. */
const AccountLockedErrorSchema = ApiErrorBodySchema.extend({
	error: LockedErrorCodeSchema,
	lockedUntil: EpochMsSchema,
	remainingSeconds: z.number().int().min(0),
});

/**
 * Normalize an unknown thrown value into a `string | null` message:
 * - plain string → itself
 * - `ApiError` / API error body → `message`
 * - anything else with a `.message` string → that message
 */
export function extractAuthErrorMessage(error: unknown): string | null {
	const asString = NonEmptyStringSchema.safeParse(error);
	if (asString.success) {
		return asString.data;
	}

	if (error instanceof ApiError) {
		return NonEmptyStringSchema.safeParse(error.message).data ?? null;
	}

	const apiBody = ApiErrorBodySchema.safeParse(error);
	if (apiBody.success) {
		return apiBody.data.message;
	}

	const withMessage = ErrorWithMessageSchema.safeParse(error);
	if (withMessage.success) {
		return withMessage.data.message;
	}

	return null;
}

/**
 * Resolve the best user-facing message for a thrown API error.
 *
 * Priority:
 * 1. A known auth error `code` → friendly catalog string for the locale
 * 2. The server's own `message` (or any `.message`)
 * 3. A generic fallback
 */
export function resolveAuthErrorMessage(error: unknown, locale: Locale = DEFAULT_LOCALE): string {
	const catalog: AuthMessageCatalog = AUTH_MESSAGE_CATALOGS[locale];

	if (error instanceof ApiError && error.error !== undefined) {
		// safeParse narrows `error.error` to a real enum member, and the catalog
		// type guarantees a string for every member — so the lookup can't miss.
		const code = AuthErrorCodeSchema.safeParse(error.error);
		if (code.success) {
			return catalog[code.data];
		}
	}

	return extractAuthErrorMessage(error) ?? GENERIC_MESSAGE;
}

/**
 * True when the thrown error is an `ACCOUNT_LOCKED` response carrying a lockout
 * payload — the login form uses this to render a live countdown instead of the
 * static message.
 */
export function isAccountLockedError(error: unknown): error is ApiError & { readonly lockedUntil: EpochMs; readonly remainingSeconds: number } {
	if (!(error instanceof ApiError)) return false;

	return AccountLockedErrorSchema.safeParse({
		message: error.message,
		error: error.error,
		statusCode: error.statusCode,
		lockedUntil: error.lockedUntil,
		remainingSeconds: error.remainingSeconds,
	}).success;
}
