import { FileText, LayoutDashboard } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { menuIconResolver } from "@workspace/ui/lib/sidebar/navigation/menu-icon";
import { resolveSidebarMenuTrail, withTrailTailLabel, type SidebarTrailPage } from "@workspace/ui/lib/sidebar/navigation/resolve-sidebar-menu-trail";
import { identitySidebarResolveHref, type SidebarResolveHref } from "@workspace/ui/lib/sidebar/resolve-menu-hrefs";

import { MERCHANT_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { resolveTenantPageRoute, type TenantPageRoute } from "@/lib/navigation/tenant-route-authorization";
import { toTenantRelativePath } from "@/lib/routes";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";

/** Crumb icons from the sidebar map; a page without one shows a document. */
const resolveIcon = menuIconResolver(MERCHANT_MENU_ICON_MAP, FileText);

export { withTrailTailLabel };

/** Crumb labels for tenant pages the sidebar has no item for (otherwise the humanized URL segment is used). */
const TENANT_PAGE_CRUMB_LABELS: Readonly<Partial<Record<TenantPageRoute, string>>> = {
	"/rewards/[rewardId]": "Reward",
	"/rewards/[rewardId]/edit": "Edit reward",
};

/**
 * Below the deepest sidebar match, only real tenant pages become crumbs — so
 * `/rewards/<id>/edit` reads Rewards › Reward › Edit reward, never the raw id.
 */
function resolveMerchantTrailPage(tenantRelativePath: string): SidebarTrailPage | null {
	const route = resolveTenantPageRoute(tenantRelativePath);
	if (route === undefined) {
		return null;
	}
	return { label: TENANT_PAGE_CRUMB_LABELS[route] };
}

/**
 * Builds the breadcrumb trail for a merchant portal path from the sidebar menu.
 *
 * Menu URLs are tenant-relative, so the trail is matched in that space (the
 * `/t/{slug}` prefix is stripped first — otherwise every menu item would
 * share the `/t` root segment and the first section would win), then each
 * crumb's href is mapped back to a browser href with `resolveHref`.
 */
export function resolveMerchantTrail(pathname: string, resolveHref: SidebarResolveHref = identitySidebarResolveHref): readonly BreadcrumbItem[] {
	const trail = resolveSidebarMenuTrail({
		menu: MERCHANT_SIDEBAR_MENU,
		pathname: toTenantRelativePath(pathname) ?? pathname,
		resolveIcon,
		rootCurrentLabel: "Dashboard",
		rootIcon: LayoutDashboard,
		unknownFallbackLabel: "Dashboard",
		resolvePage: resolveMerchantTrailPage,
	});

	return trail.map((item): BreadcrumbItem => (item.href === undefined ? item : { ...item, href: resolveHref(item.href) }));
}
