import { FileText, LayoutDashboard, type LucideIcon } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { normalizePath } from "@workspace/ui/lib/sidebar/navigation/breadcrumb-tree";
import { resolveSidebarMenuTrail, withTrailTailLabel } from "@workspace/ui/lib/sidebar/navigation/resolve-sidebar-menu-trail";

import { WEB_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { resolveWebTrailPage } from "@/lib/navigation/route-access";
import { USER_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { isPathWithin, ROUTE_PREFIXES } from "@/lib/routes";

function resolveIcon(iconName: string | undefined): LucideIcon {
	if (iconName !== undefined) {
		const resolved = WEB_MENU_ICON_MAP[iconName];
		if (resolved !== undefined) {
			return resolved;
		}
	}
	return FileText;
}

export { withTrailTailLabel };

/**
 * Builds the breadcrumb trail for a consumer Reward Hub path from the sidebar menu.
 *
 * The trail starts at the page's own menu item (`Browse Rewards`, `My Wallet`):
 * the consumer menu's sections are plain groupings, so no section crumb is
 * prepended. Below a menu item, only real pages become crumbs (from
 * `WEB_ROUTE_ACCESS`) — `/rewardhub/rewards` has no page, so a reward detail
 * reads `Browse Rewards › Reward` until the page sets the reward's title.
 */
export function resolveWebTrail(pathname: string): readonly BreadcrumbItem[] {
	const normalizedPath = normalizePath(pathname);

	if (isPathWithin(normalizedPath, ROUTE_PREFIXES.auth)) {
		return [];
	}

	return resolveSidebarMenuTrail({
		menu: USER_SIDEBAR_MENU,
		pathname,
		resolveIcon,
		rootCurrentLabel: "Dashboard",
		rootIcon: LayoutDashboard,
		unknownFallbackLabel: "Dashboard",
		includeSectionContext: false,
		resolvePage: resolveWebTrailPage,
	});
}
