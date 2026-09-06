import type { EnrollmentReason } from "@workspace/shared";

import { ApiError } from "../api/use-api";
import { decodeJwtPayload } from "./jwt";

export type AuthAppMode = "web" | "admin" | "merchant";

const ENROLLMENT_MESSAGE_KEY = "auth:enrollment-message";

const ENROLLMENT_ALLOWED_PREFIXES: readonly string[] = ["/auth/verify-email", "/auth/login", "/rewardhub/settings", "/settings"];

/** Whether the access token represents a restricted enrollment session. */
export function isRestrictedSession(token: string): boolean {
	const payload = decodeJwtPayload(token);
	return payload?.sessionScope === "restricted";
}

/** Settings path where the user completes email verification or MFA enrollment. */
export function getEnrollmentRedirectPath(mode: AuthAppMode, _enrollmentReason: EnrollmentReason): string {
	if (mode === "web") {
		return "/rewardhub/settings";
	}

	return "/settings";
}

/** Frontend routes a restricted session may visit without being redirected. */
export function isEnrollmentAllowedPath(pathname: string): boolean {
	return ENROLLMENT_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Persist an enrollment banner message across the post-login redirect. */
export function markEnrollmentMessage(message: string): void {
	sessionStorage.setItem(ENROLLMENT_MESSAGE_KEY, message);
}

/** Returns the stored enrollment message once, then clears it. */
export function consumeEnrollmentMessage(): string | null {
	const value = sessionStorage.getItem(ENROLLMENT_MESSAGE_KEY);
	if (value === null) {
		return null;
	}
	sessionStorage.removeItem(ENROLLMENT_MESSAGE_KEY);
	return value;
}

/** Whether an API error indicates the route is blocked for restricted sessions. */
export function isRestrictedSessionError(error: unknown): boolean {
	return error instanceof ApiError && error.error === "RESTRICTED_SESSION";
}
