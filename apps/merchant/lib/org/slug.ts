import { clearPreferenceCookie, writePreferenceCookie } from "@/lib/org/preference-cookie";

/**
 * Cookie remembering the last organization the member opened. The URL owns the
 * active organization (`/orgs/[orgSlug]`); this is only a preference read by
 * entry routes outside it (`/`, `/account`, the org layout's fallback redirect)
 * — and only after the server matched it against the member's memberships.
 * Written in exactly one place: `OrgTenantBootstrap` in the org layout; cleared
 * on sign-out.
 */
export const ORGANIZATION_SLUG_COOKIE_NAME = "organizationSlug";

export function writeOrganizationSlugCookie(slug: string): void {
	writePreferenceCookie(ORGANIZATION_SLUG_COOKIE_NAME, slug);
}

export function clearOrganizationSlugCookie(): void {
	clearPreferenceCookie(ORGANIZATION_SLUG_COOKIE_NAME);
}
