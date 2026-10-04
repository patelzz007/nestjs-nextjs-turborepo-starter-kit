import { clearPreferenceCookie, listCookieNamesWithPrefix, writePreferenceCookie } from "@/lib/org/preference-cookie";

/**
 * Cookie mirroring the member's chosen store (tenant-context feature effect) so
 * server pages prefetch that store's data. One cookie PER ORGANIZATION
 * (`organizationLocationId.<orgSlug>`): a store belongs to exactly one
 * organization, so switching organizations neither leaks nor loses a choice.
 * Client input — the server parses its shape and keeps it only when it names a
 * store the member may operate on in that organization (`loadServerLocationScope`).
 */
export const ORGANIZATION_LOCATION_COOKIE_PREFIX = "organizationLocationId.";

/** The store-choice cookie of one organization (the slug charset is cookie-name safe). */
export function organizationLocationCookieName(orgSlug: string): string {
	return `${ORGANIZATION_LOCATION_COOKIE_PREFIX}${orgSlug}`;
}

export function writeOrganizationLocationCookie(orgSlug: string, locationId: string): void {
	writePreferenceCookie(organizationLocationCookieName(orgSlug), locationId);
}

export function clearOrganizationLocationCookie(orgSlug: string): void {
	clearPreferenceCookie(organizationLocationCookieName(orgSlug));
}

/** Drops the store choice of every organization (sign-out). */
export function clearAllOrganizationLocationCookies(): void {
	for (const name of listCookieNamesWithPrefix(ORGANIZATION_LOCATION_COOKIE_PREFIX)) {
		clearPreferenceCookie(name);
	}
}
