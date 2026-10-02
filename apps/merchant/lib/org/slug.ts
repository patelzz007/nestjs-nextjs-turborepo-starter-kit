/**
 * Cookie remembering the last organization the member opened. The URL owns the
 * active organization (`/orgs/[orgSlug]`); this is only a preference read by
 * entry routes outside it (`/`, `/account`, the org layout's fallback redirect).
 * Written in exactly one place: `OrgTenantBootstrap` in the org layout.
 */
export const ORGANIZATION_SLUG_COOKIE_NAME = "organizationSlug";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function writeOrganizationSlugCookie(slug: string): void {
	document.cookie = `${ORGANIZATION_SLUG_COOKIE_NAME}=${encodeURIComponent(slug)}; path=/; max-age=${String(COOKIE_MAX_AGE_SECONDS)}; samesite=lax`;
}
