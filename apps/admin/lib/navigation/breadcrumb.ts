import { FileText, Home, type LucideIcon } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { resolveSidebarMenuTrail, withTrailTailLabel } from "@workspace/ui/lib/sidebar/navigation/resolve-sidebar-menu-trail";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";

function resolveIcon(iconName: string | undefined): LucideIcon {
	if (iconName !== undefined) {
		const resolved = ICON_MAP[iconName];
		if (resolved !== undefined) {
			return resolved;
		}
	}
	return FileText;
}

export { withTrailTailLabel };

/**
 * Builds the breadcrumb trail for a given admin path from the sidebar menu.
 * Pages below a menu entry without being one (`/catalog/products/42/edit`)
 * anchor on the closest entry above them, leaf or branch (shared resolver).
 */
export function resolveAdminTrail(pathname: string): readonly BreadcrumbItem[] {
	return resolveSidebarMenuTrail({
		menu: SIDEBAR_MENU,
		pathname,
		resolveIcon,
		rootCurrentLabel: "Overview",
		rootIcon: Home,
		unknownFallbackLabel: "Overview",
	});
}

/**
 * The trail with a link only on crumbs the session may open: a crumb whose
 * page the route guard would deny keeps its label (it is still where the page
 * sits) but is not a link — the breadcrumb never offers a page the sidebar
 * hides.
 */
export function withAccessibleLinks(trail: readonly BreadcrumbItem[], canAccess: (href: string) => boolean): readonly BreadcrumbItem[] {
	return trail.map((crumb): BreadcrumbItem => (crumb.href === undefined || canAccess(crumb.href) ? crumb : { ...crumb, href: undefined }));
}
