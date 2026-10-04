/** Route helpers shared by `proxy.ts`, the login page, and the client auth wrapper. */

import { AUTH_SECTION_PREFIX, isPathWithin, ROUTES } from "@/lib/routes";

/** The admin auth pages — open to unauthenticated visitors. Every entry has a page under `app/auth`. */
export const ADMIN_AUTH_ROUTE_PREFIXES: readonly string[] = [ROUTES.auth.login, ROUTES.auth.forgotPassword, ROUTES.auth.resetPassword, ROUTES.auth.verifyEmail];

/** Token links (emailed by the API) must run even when an admin session cookie is already set. */
export const ADMIN_TOKEN_AUTH_ROUTE_PREFIXES: readonly string[] = [ROUTES.auth.verifyEmail, ROUTES.auth.resetPassword];

/** True for an admin auth page (segment-aware: `/auth/login` matches, `/auth/loginx` does not). */
export function isAdminAuthPath(pathname: string): boolean {
	return ADMIN_AUTH_ROUTE_PREFIXES.some((route) => isPathWithin(pathname, route));
}

/** True for an emailed token link (verify email, reset password). */
export function isAdminTokenAuthPath(pathname: string): boolean {
	return ADMIN_TOKEN_AUTH_ROUTE_PREFIXES.some((route) => isPathWithin(pathname, route));
}

/**
 * Characters that must never appear in a redirect target, raw or
 * percent-decoded: a backslash (browsers treat `\` as `/`, so `/\evil.com`
 * is protocol-relative) and every C0 control character plus DEL (the URL
 * parser strips tab/CR/LF, so `/\t/evil.com` becomes `//evil.com`).
 */
const BACKSLASH = "\\";
/** Highest C0 control code point (U+001F). */
const LAST_C0_CONTROL_CODE_POINT = 0x1f;
/** DEL (U+007F). */
const DELETE_CODE_POINT = 0x7f;

function containsUnsafeCharacter(value: string): boolean {
	for (const character of value) {
		const codePoint: number | undefined = character.codePointAt(0);
		if (character === BACKSLASH || codePoint === undefined || codePoint <= LAST_C0_CONTROL_CODE_POINT || codePoint === DELETE_CODE_POINT) {
			return true;
		}
	}
	return false;
}

/** A pathname that starts with two slashes is protocol-relative (`//evil.com`). */
const PROTOCOL_RELATIVE_PREFIX = "//";

/** Percent-decodes `value`, or `null` when it is not valid percent-encoding. */
function decodeOrNull(value: string): string | null {
	try {
		return decodeURIComponent(value);
	} catch {
		return null;
	}
}

function hasUnsafeCharacters(value: string): boolean {
	const decoded: string | null = decodeOrNull(value);
	return decoded === null || containsUnsafeCharacter(value) || containsUnsafeCharacter(decoded);
}

/**
 * The post-login target for a `?redirect=` value, or `null` when it is not a
 * safe in-app path. Safe means: a path (starts with exactly one `/`) with no
 * backslash or control character (raw or percent-decoded) that, resolved
 * against the admin origin, stays on that origin and lies outside the auth
 * pages (case-insensitively, so `/AUTH/login` cannot bounce back into the
 * login flow). The result is the normalized `pathname + search + hash` of the
 * parsed URL — never the raw input — so what the browser follows is exactly
 * what was checked.
 */
export function resolveSafeAdminRedirect(raw: string, origin: string): string | null {
	if (!raw.startsWith("/") || raw.startsWith(PROTOCOL_RELATIVE_PREFIX) || hasUnsafeCharacters(raw)) {
		return null;
	}
	const base = new URL(origin);
	const target = new URL(raw, base);
	if (target.origin !== base.origin || target.pathname.startsWith(PROTOCOL_RELATIVE_PREFIX)) {
		return null;
	}
	const decodedPathname: string | null = decodeOrNull(target.pathname);
	if (decodedPathname === null || decodedPathname.startsWith(PROTOCOL_RELATIVE_PREFIX) || isPathWithin(decodedPathname.toLowerCase(), AUTH_SECTION_PREFIX)) {
		return null;
	}
	return `${target.pathname}${target.search}${target.hash}`;
}

/** {@link resolveSafeAdminRedirect}, falling back to the panel home for a missing or unsafe value. */
export function resolveAdminRedirectTarget(raw: string | null | undefined, origin: string): string {
	if (raw === null || raw === undefined) {
		return ROUTES.home;
	}
	return resolveSafeAdminRedirect(raw, origin) ?? ROUTES.home;
}
