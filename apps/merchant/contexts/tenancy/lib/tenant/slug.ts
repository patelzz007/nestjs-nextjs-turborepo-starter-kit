import { clearPreferenceCookie, writePreferenceCookie } from "@/contexts/tenancy/lib/tenant/preference-cookie";

/**
 * Cookie remembering the last tenant the member opened. The URL owns the
 * active tenant (`/t/[tenantSlug]`); this is only a preference read by
 * entry routes outside it (`/`, `/account`, the tenant layout's fallback redirect)
 * — and only after the server matched it against the member's memberships.
 * Written in exactly one place: `TenantBootstrap` in the tenant layout; cleared
 * on sign-out.
 */
export const TENANT_SLUG_COOKIE_NAME = "tenantSlug";

export function writeTenantSlugCookie(slug: string): void {
	writePreferenceCookie(TENANT_SLUG_COOKIE_NAME, slug);
}

export function clearTenantSlugCookie(): void {
	clearPreferenceCookie(TENANT_SLUG_COOKIE_NAME);
}
