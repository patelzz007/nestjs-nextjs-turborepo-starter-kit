import { clearPreferenceCookie, listCookieNamesWithPrefix, writePreferenceCookie } from "@/contexts/tenancy/lib/org/preference-cookie";

/**
 * Cookie mirroring the member's chosen store (tenant-context feature effect) so
 * server pages prefetch that store's data. One cookie PER TENANT
 * (`tenantLocationId.<orgSlug>`): a store belongs to exactly one
 * tenant, so switching tenants neither leaks nor loses a choice.
 * Client input — the server parses its shape and keeps it only when it names a
 * store the member may operate on in that tenant (`loadServerLocationScope`).
 */
export const TENANT_LOCATION_COOKIE_PREFIX = "tenantLocationId.";

/** The store-choice cookie of one tenant (the slug charset is cookie-name safe). */
export function locationCookieName(tenantSlug: string): string {
	return `${TENANT_LOCATION_COOKIE_PREFIX}${tenantSlug}`;
}

export function writeLocationCookie(tenantSlug: string, locationId: string): void {
	writePreferenceCookie(locationCookieName(tenantSlug), locationId);
}

export function clearLocationCookie(tenantSlug: string): void {
	clearPreferenceCookie(locationCookieName(tenantSlug));
}

/** Drops the store choice of every tenant (sign-out). */
export function clearAllLocationCookies(): void {
	for (const name of listCookieNamesWithPrefix(TENANT_LOCATION_COOKIE_PREFIX)) {
		clearPreferenceCookie(name);
	}
}
