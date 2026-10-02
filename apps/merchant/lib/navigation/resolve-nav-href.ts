import { isAppPath, isOrgScopedPath, resolveOrgHref } from "@/lib/routes";
import type { SidebarResolveHref } from "@workspace/ui/lib/sidebar/resolve-menu-hrefs";

/** Menu placeholders (`#`) and absolute external links are never rewritten. */
function isPassThroughMenuUrl(menuUrl: string): boolean {
	return menuUrl.startsWith("#") || menuUrl.startsWith("http://") || menuUrl.startsWith("https://");
}

/**
 * Builds a menu-URL → browser-href resolver for the merchant portal.
 *
 * Sidebar / palette URLs are org-relative (`ORG_ROUTES.*`, e.g. `/rewards`)
 * and resolve to `/orgs/{slug}/rewards`. Already org-scoped URLs pass through,
 * so the resolver is idempotent. Without an organization slug, menu URLs
 * resolve to the top-level entry page that picks the organization server-side.
 */
export function createMerchantNavHrefResolver(organizationSlug: string | undefined): SidebarResolveHref {
	return (menuUrl: string): string => {
		if (isPassThroughMenuUrl(menuUrl) || isOrgScopedPath(menuUrl) || !isAppPath(menuUrl)) {
			return menuUrl;
		}
		return resolveOrgHref(organizationSlug, menuUrl);
	};
}
