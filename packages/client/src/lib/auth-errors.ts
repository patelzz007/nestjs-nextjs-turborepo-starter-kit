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

import { AuthErrorCodeSchema, type AuthErrorCode } from "@workspace/shared";

import { ApiError } from "./use-api";

// ── Locale plumbing ──────────────────────────────────────────────────────
// A new locale = one more entry in this record. The resolver takes a locale
// param (default "en") so nothing downstream needs to change to go multilingual.

export type Locale = "en";

/** One locale's message catalog — one friendly string per canonical code. */
export type AuthMessageCatalog = Readonly<Record<AuthErrorCode, string>>;

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

/**
 * Normalize an unknown thrown value into a `string | null` message:
 * - `ApiError` → the friendly catalog string (or its server message)
 * - anything with a `.message` → that message
 * - a plain string → itself
 */
export function extractAuthErrorMessage(error: unknown): string | null {
	if (typeof error === "string" && error.length > 0) {
		return error;
	}
	if (typeof error === "object" && error !== null && "message" in error) {
		const message: unknown = error.message;
		if (typeof message === "string" && message.length > 0) {
			return message;
		}
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
export function isAccountLockedError(error: unknown): error is ApiError & { readonly lockedUntil: string; readonly remainingSeconds: number } {
	if (!(error instanceof ApiError)) return false;
	if (error.error !== "ACCOUNT_LOCKED") return false;
	return typeof error.lockedUntil === "string" && typeof error.remainingSeconds === "number";
}
