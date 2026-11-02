// ============================================
// error-messages.ts - what the user reads when a request fails
// ============================================
// The API's stable auth codes map to friendly copy (the same catalog idea as
// the web's `resolveAuthErrorMessage`); other API errors show the server's own
// message (the standard error envelope, ADR 016); anything else is generic.

import { ApiError, rateLimitMessage, SessionRefreshUnavailableError } from "@workspace/api-client";
import { AuthErrorCodeSchema, type AuthErrorCode } from "@workspace/shared";

const AUTH_ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
	INVALID_CREDENTIALS: "Incorrect email or password. Please try again.",
	ADMIN_ACCESS_REQUIRED: "This account doesn't have admin access.",
	EMAIL_NOT_VERIFIED: "Please verify your email address before continuing.",
	ACCESS_TOKEN_MISSING: "Your session has ended. Please sign in again.",
	ACCESS_TOKEN_INVALID: "Your session has ended. Please sign in again.",
	ACCESS_TOKEN_EXPIRED: "Your session has ended. Please sign in again.",
	SESSION_REVOKED: "This device was signed out. Please sign in again.",
	REFRESH_TOKEN_MISSING: "Your session has ended. Please sign in again.",
	REFRESH_TOKEN_INVALID: "Your session has ended. Please sign in again.",
	REFRESH_TOKEN_EXPIRED: "Your session has ended. Please sign in again.",
	REFRESH_TOKEN_TRANSPORT_MISMATCH: "Your session could not be renewed. Please sign in again.",
	TOKEN_THEFT_DETECTED: "Suspicious activity was detected. All sessions were signed out for your safety.",
	USER_NOT_FOUND: "This account no longer exists. Please contact support.",
	ACCOUNT_IS_INACTIVE: "This account is inactive. Please contact support.",
	ACCOUNT_DELETED: "This account has been deleted. Please contact support.",
	SUPER_ADMIN_REQUIRED: "Super administrator access is required for this action.",
};

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export const OFFLINE_ERROR_MESSAGE = "We couldn't reach the server. Check your connection and try again.";

/** The message to show for a failed request. */
export function errorMessageOf(error: Error | null): string {
	if (error === null) {
		return GENERIC_ERROR_MESSAGE;
	}
	if (error instanceof SessionRefreshUnavailableError) {
		return OFFLINE_ERROR_MESSAGE;
	}
	if (error instanceof ApiError) {
		const code = AuthErrorCodeSchema.safeParse(error.code);
		if (code.success) {
			return AUTH_ERROR_MESSAGES[code.data];
		}
		// A 429 says how long to wait, from the API's `retryAfterSeconds` (ADR 071).
		const tooFast = rateLimitMessage(error);
		if (tooFast !== null) {
			return tooFast;
		}
		return error.message.length > 0 ? error.message : GENERIC_ERROR_MESSAGE;
	}
	// A failed fetch (no HTTP answer) surfaces as a TypeError in React Native.
	if (error instanceof TypeError) {
		return OFFLINE_ERROR_MESSAGE;
	}
	return GENERIC_ERROR_MESSAGE;
}
