import type { CaughtValue, EnrollmentReason } from "@workspace/shared";

import { ApiError } from "../../api/use-api";
import { decodeJwtPayload } from "./jwt";

export type AuthAppMode = "web" | "admin" | "merchant";

const ENROLLMENT_MESSAGE_KEY = "auth:enrollment-message";

/**
 * Personal account pages — where a restricted session completes email
 * verification or MFA enrollment (docs/routing.md: `/account` is personal,
 * `/settings` is org / platform configuration).
 *
 * - web: `/rewardhub/account` (the signed-in shell lives under `/rewardhub`)
 * - admin: `/account`
 * - merchant: `/orgs/{slug}/account`; `/account` resolves the organization
 *   server-side when the slug is not known yet
 */
const WEB_ACCOUNT_PATH = "/rewardhub/account";
const ACCOUNT_PATH = "/account";

const ENROLLMENT_ALLOWED_PREFIXES: readonly string[] = ["/auth/verify-email", "/auth/login", WEB_ACCOUNT_PATH, ACCOUNT_PATH];

const ORG_ACCOUNT_PATH_PATTERN = /^\/orgs\/[^/]+\/account(?:\/|$)/;

/** Whether the access token represents a restricted enrollment session. */
export function isRestrictedSession(token: string): boolean {
	const payload = decodeJwtPayload(token);
	return payload?.sessionScope === "restricted";
}

/** Account path where the user completes email verification or MFA enrollment. */
export function getEnrollmentRedirectPath(mode: AuthAppMode, _enrollmentReason: EnrollmentReason, organizationSlug?: string): string {
	if (mode === "web") return WEB_ACCOUNT_PATH;

	if (mode === "merchant" && organizationSlug !== undefined && organizationSlug.length > 0) return `/orgs/${organizationSlug}${ACCOUNT_PATH}`;

	return ACCOUNT_PATH;
}

/** Frontend routes a restricted session may visit without being redirected. */
export function isEnrollmentAllowedPath(pathname: string): boolean {
	if (ENROLLMENT_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
		return true;
	}

	return ORG_ACCOUNT_PATH_PATTERN.test(pathname);
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
export function isRestrictedSessionError(error: CaughtValue): boolean {
	return error instanceof ApiError && error.error === "RESTRICTED_SESSION";
}
