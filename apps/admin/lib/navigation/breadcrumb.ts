import { FileText, Home, type LucideIcon } from "lucide-react";

import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";
import { resolveSidebarMenuTrail, withTrailTailLabel } from "@workspace/ui/lib/navigation/resolve-sidebar-menu-trail";

import { ICON_MAP } from "@/lib/navigation/menu-icons";
import { useSidebarStore } from "@/stores/sidebar-store";

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

/** Builds the breadcrumb trail for a given admin path from the sidebar menu. */
export function resolveAdminTrail(pathname: string): readonly BreadcrumbItem[] {
	return resolveSidebarMenuTrail({
		menu: useSidebarStore.getState().menu,
		pathname,
		resolveIcon,
		rootCurrentLabel: "Overview",
		rootIcon: Home,
		unknownFallbackLabel: "Overview",
	});
}
