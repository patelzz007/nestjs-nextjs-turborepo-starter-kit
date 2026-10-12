// Whether the desktop sidebar is open, mirrored into a cookie so the SERVER
// renders the shell as the person left it. The sidebar's preferences live in
// localStorage (store.ts), which the server cannot read: without this the
// first paint is always "open", and a collapsed sidebar shows for a moment
// before it shuts. Server-safe (no "use client"): server layouts import it.

import { z } from "zod";

/** The cookie's value: exactly what the sidebar's cookie storage writes. */
const SidebarOpenCookieValueSchema = z.enum(["true", "false"]);

/** One year: a layout preference, not a session. */
export const SIDEBAR_OPEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** The cookie of one app's sidebar (its store key, so admin, web and merchant never share one). */
export function sidebarOpenCookieName(storageKey: string): string {
	return `${storageKey}-open`;
}

/** The open state a cookie holds; `undefined` when it is missing or not one we wrote (untrusted input). */
export function parseSidebarOpenCookie(value: string | undefined): boolean | undefined {
	const parsed = SidebarOpenCookieValueSchema.safeParse(value);
	return parsed.success ? parsed.data === "true" : undefined;
}

/** What the server's cookie store offers (Next's `cookies()`), narrowed to the one read we make. */
export interface ReadableCookies {
	get(name: string): { readonly value: string } | undefined;
}

/** The sidebar's open state for a server render; `undefined` (the app's default) when no valid cookie is set. */
export function readSidebarOpenCookie(cookies: ReadableCookies, storageKey: string): boolean | undefined {
	return parseSidebarOpenCookie(cookies.get(sidebarOpenCookieName(storageKey))?.value);
}
