import { FileText, LayoutDashboard, type LucideIcon } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";
import { normalizePath } from "@workspace/ui/lib/navigation/breadcrumb-tree";
import { resolveSidebarMenuTrail, withTrailTailLabel } from "@workspace/ui/lib/navigation/resolve-sidebar-menu-trail";

import { WEB_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { useWebSidebarStore } from "@/stores/sidebar-store";

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

/** Builds the breadcrumb trail for a consumer Reward Hub path from the sidebar menu. */
export function resolveWebTrail(pathname: string): readonly BreadcrumbItem[] {
	const normalizedPath = normalizePath(pathname);

	if (normalizedPath.startsWith("/auth")) {
		return [];
	}

	return resolveSidebarMenuTrail({
		menu: useWebSidebarStore.getState().menu,
		pathname,
		resolveIcon,
		rootCurrentLabel: "Dashboard",
		rootIcon: LayoutDashboard,
		unknownFallbackLabel: "Dashboard",
	});
}
