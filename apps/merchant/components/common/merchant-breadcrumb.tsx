"use client";

import { createBreadcrumbContext } from "@workspace/ui/components/breadcrumb-context";
import { usePathname } from "next/navigation";
import * as React from "react";

import { resolveMerchantTrail } from "@/lib/navigation/breadcrumb";
import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";
import { useTenantSlug } from "@/contexts/tenancy/lib/tenant/use-tenant-slug";
import { useTranslatedSidebarMenu } from "@workspace/client/lib/sidebar/sidebar-menu-labels";
import { useUiKitLanguage } from "@workspace/ui/components/ui-kit-labels-provider";
import { MERCHANT_SIDEBAR_LABELS } from "@/lib/navigation/sidebar-labels";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";

const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolveMerchantTrail);

interface MerchantBreadcrumbProviderProps {
	readonly children: React.ReactNode;
}

function MerchantBreadcrumbProvider({ children }: MerchantBreadcrumbProviderProps): React.JSX.Element {
	const pathname = usePathname();
	const tenantSlug = useTenantSlug();
	const resolveHref = React.useMemo(() => createMerchantNavHrefResolver(tenantSlug), [tenantSlug]);
	// In the language on screen (5.12): the sidebar's own words, so a crumb always matches its menu item.
	const menu = useTranslatedSidebarMenu(MERCHANT_SIDEBAR_MENU, MERCHANT_SIDEBAR_LABELS);
	const language = useUiKitLanguage()?.language ?? "en";
	const resolveTrail = React.useCallback((currentPathname: string) => resolveMerchantTrail(currentPathname, resolveHref, menu, language), [language, menu, resolveHref]);

	return (
		<BreadcrumbProvider pathname={pathname} resolve={resolveTrail}>
			{children}
		</BreadcrumbProvider>
	);
}

export { MerchantBreadcrumbProvider, useBreadcrumb as useMerchantBreadcrumb };
