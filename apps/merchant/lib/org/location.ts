/** Cookie for the active store location within the current organization workspace. */
export const ORGANIZATION_LOCATION_ID_COOKIE_NAME = "organizationLocationId";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function writeOrganizationLocationCookie(locationId: string): void {
	document.cookie = `${ORGANIZATION_LOCATION_ID_COOKIE_NAME}=${encodeURIComponent(locationId)}; path=/; max-age=${String(COOKIE_MAX_AGE_SECONDS)}; samesite=lax`;
}

export function clearOrganizationLocationCookie(): void {
	document.cookie = `${ORGANIZATION_LOCATION_ID_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

export function readOrganizationLocationCookie(): string | undefined {
	if (typeof document === "undefined") {
		return undefined;
	}
	const prefix = `${ORGANIZATION_LOCATION_ID_COOKIE_NAME}=`;
	const match = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
	if (match === undefined) {
		return undefined;
	}
	const value = match.slice(prefix.length);
	return value.length > 0 ? decodeURIComponent(value) : undefined;
}
