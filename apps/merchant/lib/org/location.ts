/**
 * Cookie mirroring the member's chosen store (tenant-context feature effect) so
 * server pages prefetch that store's data. Client input — the server only
 * checks its shape and the API re-validates access on every request.
 */
export const ORGANIZATION_LOCATION_ID_COOKIE_NAME = "organizationLocationId";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function writeOrganizationLocationCookie(locationId: string): void {
	document.cookie = `${ORGANIZATION_LOCATION_ID_COOKIE_NAME}=${encodeURIComponent(locationId)}; path=/; max-age=${String(COOKIE_MAX_AGE_SECONDS)}; samesite=lax`;
}

export function clearOrganizationLocationCookie(): void {
	document.cookie = `${ORGANIZATION_LOCATION_ID_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}
