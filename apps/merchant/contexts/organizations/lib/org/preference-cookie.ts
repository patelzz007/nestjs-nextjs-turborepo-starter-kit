import { clientEnv } from "@/lib/env/env.client";

/**
 * Browser writer for the merchant portal's non-secret preference cookies (the
 * last opened organization, the chosen store per organization). They are read
 * by server pages to prefetch the right data — never an authorization input:
 * the server re-validates every value against the member's memberships.
 *
 * `Secure` follows the portal's own origin: set whenever the portal is served
 * over https (every deployed environment), omitted on a plain-http local
 * origin, where a browser would otherwise drop the cookie.
 */

/** Preferences outlive a session on purpose: they are remembered for a year. */
export const PREFERENCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const HTTPS_PROTOCOL = "https:";

/** Whether cookies for `origin` must carry `Secure` (an https origin). */
export function isSecureCookieOrigin(origin: string): boolean {
	return new URL(origin).protocol === HTTPS_PROTOCOL;
}

export interface PreferenceCookieAttributes {
	readonly maxAgeSeconds: number;
	readonly secure: boolean;
}

/** The `document.cookie` assignment for one preference cookie (value already encoded). */
export function serializePreferenceCookie(name: string, encodedValue: string, attributes: PreferenceCookieAttributes): string {
	const parts: string[] = [`${name}=${encodedValue}`, "path=/", `max-age=${String(attributes.maxAgeSeconds)}`, "samesite=lax"];
	if (attributes.secure) {
		parts.push("secure");
	}
	return parts.join("; ");
}

function portalCookieIsSecure(): boolean {
	return isSecureCookieOrigin(clientEnv.NEXT_PUBLIC_MERCHANT_URL);
}

export function writePreferenceCookie(name: string, value: string): void {
	document.cookie = serializePreferenceCookie(name, encodeURIComponent(value), { maxAgeSeconds: PREFERENCE_COOKIE_MAX_AGE_SECONDS, secure: portalCookieIsSecure() });
}

export function clearPreferenceCookie(name: string): void {
	document.cookie = serializePreferenceCookie(name, "", { maxAgeSeconds: 0, secure: portalCookieIsSecure() });
}

/** Names of the cookies currently visible to the page that start with `prefix`. */
export function listCookieNamesWithPrefix(prefix: string): readonly string[] {
	return document.cookie
		.split(";")
		.map((entry: string): string => entry.trim().split("=", 1).at(0) ?? "")
		.filter((name: string): boolean => name.startsWith(prefix));
}
