"use client";

import { useTranslatedSidebarMenu } from "@workspace/client/lib/sidebar/sidebar-menu-labels";
import { createBreadcrumbContext } from "@workspace/ui/components/breadcrumb-context";
import { useUiKitLanguage } from "@workspace/ui/components/ui-kit-labels-provider";
import * as React from "react";

import { resolveAdminTrail } from "@/lib/navigation/breadcrumb";
import { ADMIN_SIDEBAR_LABELS } from "@/lib/navigation/sidebar-labels";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";

/**
 * The admin's single BreadcrumbContext instance — created from the shared
 * factory with the admin-specific route resolver (sidebar menu + icons).
 * Wrap the dashboard layout with `<AdminBreadcrumbProvider pathname={...}>`
 * and read the trail with `useAdminBreadcrumb()`.
 */
const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolveAdminTrail);

interface AdminBreadcrumbProviderProps {
	readonly pathname: string;
	readonly children: React.ReactNode;
}

/** The trail in the language on screen (5.12): the sidebar's own words, so a crumb always matches its menu item. */
function AdminBreadcrumbProvider({ pathname, children }: AdminBreadcrumbProviderProps): React.JSX.Element {
	const menu = useTranslatedSidebarMenu(SIDEBAR_MENU, ADMIN_SIDEBAR_LABELS);
	const language = useUiKitLanguage()?.language ?? "en";
	const resolveTrail = React.useCallback((currentPathname: string) => resolveAdminTrail(currentPathname, menu, language), [language, menu]);
	return (
		<BreadcrumbProvider pathname={pathname} resolve={resolveTrail}>
			{children}
		</BreadcrumbProvider>
	);
}

export { AdminBreadcrumbProvider, useBreadcrumb as useAdminBreadcrumb };
