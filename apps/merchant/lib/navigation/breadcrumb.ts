import { FileText, LayoutDashboard, type LucideIcon } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";
import { resolveSidebarMenuTrail, withTrailTailLabel } from "@workspace/ui/lib/navigation/resolve-sidebar-menu-trail";

import { MERCHANT_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { useMerchantSidebarStore } from "@/stores/sidebar-store";

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

/** Builds the breadcrumb trail for a merchant portal path from the sidebar menu. */
export function resolveMerchantTrail(pathname: string): readonly BreadcrumbItem[] {
	return resolveSidebarMenuTrail({
		menu: useMerchantSidebarStore.getState().menu,
		pathname,
		resolveIcon,
		rootCurrentLabel: "Dashboard",
		rootIcon: LayoutDashboard,
		unknownFallbackLabel: "Dashboard",
	});
}
