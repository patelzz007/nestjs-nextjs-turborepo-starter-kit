import { isAppPath, isTenantScopedPath, resolveTenantHref } from "@/lib/routes";
import type { SidebarResolveHref } from "@workspace/ui/lib/sidebar/resolve-menu-hrefs";

/** Menu placeholders (`#`) and absolute external links are never rewritten. */
function isPassThroughMenuUrl(menuUrl: string): boolean {
	return menuUrl.startsWith("#") || menuUrl.startsWith("http://") || menuUrl.startsWith("https://");
}

/**
 * Builds a menu-URL → browser-href resolver for the merchant portal.
 *
 * Sidebar / palette URLs are org-relative (`TENANT_ROUTES.*`, e.g. `/rewards`)
 * and resolve to `/t/{slug}/rewards`. Already org-scoped URLs pass through,
 * so the resolver is idempotent. Without a tenant slug, menu URLs
 * resolve to the top-level entry page that picks the tenant server-side.
 */
export function createMerchantNavHrefResolver(tenantSlug: string | undefined): SidebarResolveHref {
	return (menuUrl: string): string => {
		if (isPassThroughMenuUrl(menuUrl) || isTenantScopedPath(menuUrl) || !isAppPath(menuUrl)) {
			return menuUrl;
		}
		return resolveTenantHref(tenantSlug, menuUrl);
	};
}
