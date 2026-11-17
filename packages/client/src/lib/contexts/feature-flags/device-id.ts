import { DEVICE_ID_COOKIE, DEVICE_ID_COOKIE_MAX_AGE_SECONDS, DEVICE_ID_HEADER, DeviceIdSchema, isBrowserRuntime } from "@workspace/shared";

// ── The browser's anonymous device id (ADR 087) ──────────────────────────────────────────────────
// A random UUID in a first-party cookie, set by each web app's own proxy on the first visit and sent to the API as
// `X-Device-Id` (by the browser's API client and by server-side renders alike), so a flag decided per device
// gives one browser the same answer signed out and signed in. It identifies a browser, never a person.

/** One `name=value` pair of a `Cookie` header / `document.cookie`. */
const COOKIE_PAIR_PATTERN = /(?:^|;\s*)(?<name>[^=;\s]+)=(?<value>[^;]*)/g;

/** The value of one cookie in a `Cookie` header string, or null. */
export function readCookieValue(cookieHeader: string, name: string): string | null {
	for (const match of cookieHeader.matchAll(COOKIE_PAIR_PATTERN)) {
		if (match.groups?.name === name) {
			return decodeURIComponent(match.groups.value ?? "");
		}
	}
	return null;
}

/** `X-Device-Id` for a cookie value, or no header when the value isn't a device id. */
export function deviceIdHeaders(value: string | null | undefined): Readonly<Record<string, string>> {
	const parsed = DeviceIdSchema.safeParse(value);
	return parsed.success ? { [DEVICE_ID_HEADER]: parsed.data } : {};
}

/** The header a browser request carries, from this page's cookie (none outside a browser). */
export function browserDeviceIdHeaders(): Readonly<Record<string, string>> {
	return isBrowserRuntime() ? deviceIdHeaders(readCookieValue(document.cookie, DEVICE_ID_COOKIE)) : {};
}

/** The cookie a proxy sets when the request has none (readable by the page: it is no secret). */
export interface DeviceIdCookie {
	readonly name: string;
	readonly value: string;
	readonly maxAge: number;
	readonly path: string;
	readonly sameSite: "lax";
	readonly httpOnly: false;
	readonly secure: boolean;
}

/**
 * The device id cookie to set on a response, or null when the request already carries a valid one. A fresh id is
 * made by `newId` (`crypto.randomUUID`), so the proxy stays deterministic in tests.
 */
export function deviceIdCookieToSet(current: string | undefined, newId: () => string, secure: boolean): DeviceIdCookie | null {
	if (DeviceIdSchema.safeParse(current).success) {
		return null;
	}
	return { name: DEVICE_ID_COOKIE, value: newId(), maxAge: DEVICE_ID_COOKIE_MAX_AGE_SECONDS, path: "/", sameSite: "lax", httpOnly: false, secure };
}
