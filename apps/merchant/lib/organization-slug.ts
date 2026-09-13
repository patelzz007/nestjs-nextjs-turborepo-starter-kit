/** Cookie for active organization URL slug (canonical tenant context). */
export const ORGANIZATION_SLUG_COOKIE_NAME = "organizationSlug";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function writeOrganizationSlugCookie(slug: string): void {
	document.cookie = `${ORGANIZATION_SLUG_COOKIE_NAME}=${encodeURIComponent(slug)}; path=/; max-age=${String(COOKIE_MAX_AGE_SECONDS)}; samesite=lax`;
}

export function readOrganizationSlugCookie(): string | undefined {
	if (typeof document === "undefined") {
		return undefined;
	}
	const prefix = `${ORGANIZATION_SLUG_COOKIE_NAME}=`;
	const match = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
	if (match === undefined) {
		return undefined;
	}
	const value = match.slice(prefix.length);
	return value.length > 0 ? decodeURIComponent(value) : undefined;
}

export function organizationPath(slug: string, subpath: string = ""): string {
	const normalized = subpath.startsWith("/") ? subpath : subpath.length > 0 ? `/${subpath}` : "";
	return `/orgs/${slug}${normalized}`;
}
