import { FileText, LayoutDashboard, type LucideIcon } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { resolveSidebarMenuTrail, withTrailTailLabel, type SidebarTrailPage } from "@workspace/ui/lib/sidebar/navigation/resolve-sidebar-menu-trail";
import { identitySidebarResolveHref, type SidebarResolveHref } from "@workspace/ui/lib/sidebar/resolve-menu-hrefs";

import { MERCHANT_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { resolveOrgPageRoute, type OrgPageRoute } from "@/lib/navigation/org-route-authorization";
import { toOrgRelativePath } from "@/lib/routes";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";

function resolveIcon(iconName: string | undefined): LucideIcon {
	if (iconName !== undefined) {
		const resolved = MERCHANT_MENU_ICON_MAP[iconName];
		if (resolved !== undefined) {
			return resolved;
		}
	}
	return FileText;
}

export { withTrailTailLabel };

/** Crumb labels for org pages the sidebar has no item for (otherwise the humanized URL segment is used). */
const ORG_PAGE_CRUMB_LABELS: Readonly<Partial<Record<OrgPageRoute, string>>> = {
	"/rewards/[rewardId]/edit": "Edit reward",
};

/**
 * Below the deepest sidebar match, only real org pages become crumbs — so the
 * reward id in `/rewards/<id>/edit` (no page of its own) is not a crumb.
 */
function resolveMerchantTrailPage(orgRelativePath: string): SidebarTrailPage | null {
	const route = resolveOrgPageRoute(orgRelativePath);
	if (route === undefined) {
		return null;
	}
	return { label: ORG_PAGE_CRUMB_LABELS[route] };
}

/**
 * Builds the breadcrumb trail for a merchant portal path from the sidebar menu.
 *
 * Menu URLs are org-relative, so the trail is matched in that space (the
 * `/orgs/{slug}` prefix is stripped first — otherwise every menu item would
 * share the `/orgs` root segment and the first section would win), then each
 * crumb's href is mapped back to a browser href with `resolveHref`.
 */
export function resolveMerchantTrail(pathname: string, resolveHref: SidebarResolveHref = identitySidebarResolveHref): readonly BreadcrumbItem[] {
	const trail = resolveSidebarMenuTrail({
		menu: MERCHANT_SIDEBAR_MENU,
		pathname: toOrgRelativePath(pathname) ?? pathname,
		resolveIcon,
		rootCurrentLabel: "Dashboard",
		rootIcon: LayoutDashboard,
		unknownFallbackLabel: "Dashboard",
		resolvePage: resolveMerchantTrailPage,
	});

	return trail.map((item): BreadcrumbItem => (item.href === undefined ? item : { ...item, href: resolveHref(item.href) }));
}
