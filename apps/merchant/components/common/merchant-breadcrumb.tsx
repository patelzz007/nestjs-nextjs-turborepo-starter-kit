"use client";

import { createBreadcrumbContext } from "@workspace/ui/components/breadcrumb-context";
import { usePathname } from "next/navigation";
import * as React from "react";

import { resolveMerchantTrail } from "@/lib/navigation/breadcrumb";
import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";
import { useTenantSlug } from "@/contexts/tenancy/lib/org/use-tenant-slug";

const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolveMerchantTrail);

interface MerchantBreadcrumbProviderProps {
	readonly children: React.ReactNode;
}

function MerchantBreadcrumbProvider({ children }: MerchantBreadcrumbProviderProps): React.JSX.Element {
	const pathname = usePathname();
	const tenantSlug = useTenantSlug();
	const resolveHref = React.useMemo(() => createMerchantNavHrefResolver(tenantSlug), [tenantSlug]);
	const resolveTrail = React.useCallback((currentPathname: string) => resolveMerchantTrail(currentPathname, resolveHref), [resolveHref]);

	return (
		<BreadcrumbProvider pathname={pathname} resolve={resolveTrail}>
			{children}
		</BreadcrumbProvider>
	);
}

export { MerchantBreadcrumbProvider, useBreadcrumb as useMerchantBreadcrumb };
