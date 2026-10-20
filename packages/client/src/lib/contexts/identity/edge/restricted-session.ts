// Edge-safe (route proxies): pure functions over the token and the path — no
// browser storage, no client modules.
import type { AuthClientType, EnrollmentReason } from "@workspace/shared";

import { decodeJwtPayload } from "./jwt";

export type AuthAppMode = AuthClientType;

/**
 * Personal account pages — where a restricted session completes email
 * verification or MFA enrollment (docs/technical/frontend/routing.md: `/account` is personal,
 * `/settings` is org / platform configuration).
 *
 * - web: `/dashboard/account` (the signed-in shell lives under `/dashboard`)
 * - admin: `/account`
 * - merchant: `/t/{slug}/account`; `/account` resolves the tenant
 *   server-side when the slug is not known yet
 */
const WEB_ACCOUNT_PATH = "/dashboard/account";
const ACCOUNT_PATH = "/account";

const ENROLLMENT_ALLOWED_PREFIXES: readonly string[] = ["/auth/verify-email", "/auth/login", WEB_ACCOUNT_PATH, ACCOUNT_PATH];

const TENANT_ACCOUNT_PATH_PATTERN = /^\/t\/[^/]+\/account(?:\/|$)/;

/** Whether the access token represents a restricted enrollment session. */
export function isRestrictedSession(token: string): boolean {
	const payload = decodeJwtPayload(token);
	return payload?.sessionScope === "restricted";
}

/** Account path where the user completes email verification or MFA enrollment. */
export function getEnrollmentRedirectPath(mode: AuthAppMode, _enrollmentReason: EnrollmentReason, tenantSlug?: string): string {
	if (mode === "web") return WEB_ACCOUNT_PATH;

	if (mode === "merchant" && tenantSlug !== undefined && tenantSlug.length > 0) return `/t/${tenantSlug}${ACCOUNT_PATH}`;

	return ACCOUNT_PATH;
}

/** Frontend routes a restricted session may visit without being redirected. */
export function isEnrollmentAllowedPath(pathname: string): boolean {
	if (ENROLLMENT_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
		return true;
	}

	return TENANT_ACCOUNT_PATH_PATTERN.test(pathname);
}
