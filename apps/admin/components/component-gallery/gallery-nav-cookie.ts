// The components navigation's open state lives in its own cookie, so the
// server renders `/components/*` as it was left. Server-safe (no "use
// client"): the gallery layout, a server component, reads it — a value
// exported from a client module reaches a server component as a client
// reference, not as the string.

import { type ReadableCookies, readSidebarOpenCookie } from "@workspace/client/lib/features/sidebar/open-cookie";

/**
 * The cookie key of the components navigation's open state — its own key, so
 * it opens and closes independently of the app sidebar (`admin-sidebar-state`).
 */
export const COMPONENTS_NAV_STORAGE_KEY = "admin-components-nav";

/** Whether the server renders the components navigation open: open unless its cookie says otherwise. */
export function readComponentsNavOpen(cookies: ReadableCookies): boolean {
	return readSidebarOpenCookie(cookies, COMPONENTS_NAV_STORAGE_KEY) ?? true;
}
