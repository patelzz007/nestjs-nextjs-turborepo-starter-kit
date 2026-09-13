import { organizationPath } from "@/lib/org/slug";
import type { SidebarResolveHref } from "@workspace/ui/lib/sidebar/resolve-menu-hrefs";

/**
 * Builds a menu-URL → browser-href resolver for the merchant portal.
 * When `organizationSlug` is undefined (single-tenant / no org context), menu URLs pass through unchanged.
 */
export function createMerchantNavHrefResolver(organizationSlug: string | undefined): SidebarResolveHref {
	return (menuUrl: string): string => {
		if (organizationSlug === undefined || menuUrl.startsWith("#") || menuUrl.startsWith("http") || menuUrl.startsWith("/orgs/")) {
			return menuUrl;
		}

		const subpath = menuUrl === "/" ? "dashboard" : menuUrl.replace(/^\//, "");
		return organizationPath(organizationSlug, subpath);
	};
}
