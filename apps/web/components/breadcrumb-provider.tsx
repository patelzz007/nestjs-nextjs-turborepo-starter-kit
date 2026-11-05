"use client";

import { createBreadcrumbContext } from "@workspace/ui/components/breadcrumb-context";
import { usePathname } from "next/navigation";
import * as React from "react";

import { resolveWebTrail } from "@/lib/navigation/breadcrumb";
import { useTranslatedSidebarMenu } from "@workspace/client/lib/sidebar/sidebar-menu-labels";
import { useUiKitLanguage } from "@workspace/ui/components/ui-kit-labels-provider";
import { USER_SIDEBAR_LABELS } from "@/lib/navigation/sidebar-labels";
import { USER_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";

const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolveWebTrail);

interface WebBreadcrumbProviderProps {
	readonly children: React.ReactNode;
}

/**
 * Route-derived breadcrumb trail for the web app. A data-driven page names its
 * final crumb through `WebBreadcrumbTailLabel` (the shared context's
 * pathname-scoped `setTailLabel`).
 */
function WebBreadcrumbProvider({ children }: WebBreadcrumbProviderProps): React.JSX.Element {
	const pathname = usePathname();
	// In the language on screen (5.12): the sidebar's own words, so a crumb always matches its menu item.
	const menu = useTranslatedSidebarMenu(USER_SIDEBAR_MENU, USER_SIDEBAR_LABELS);
	const language = useUiKitLanguage()?.language ?? "en";
	const resolveTrail = React.useCallback((currentPathname: string) => resolveWebTrail(currentPathname, menu, language), [language, menu]);
	return (
		<BreadcrumbProvider pathname={pathname} resolve={resolveTrail}>
			{children}
		</BreadcrumbProvider>
	);
}

export { WebBreadcrumbProvider, useBreadcrumb as useWebBreadcrumb };
