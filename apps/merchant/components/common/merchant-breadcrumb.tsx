"use client";

import { createBreadcrumbContext } from "@workspace/ui/components/navigation/breadcrumb-context";
import { usePathname } from "next/navigation";
import * as React from "react";

import { resolveMerchantTrail } from "@/lib/navigation/breadcrumb";
import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";
import { useOrganizationSlug } from "@/lib/org/use-organization-slug";

const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolveMerchantTrail);

interface MerchantBreadcrumbProviderProps {
	readonly children: React.ReactNode;
}

function MerchantBreadcrumbProvider({ children }: MerchantBreadcrumbProviderProps): React.JSX.Element {
	const pathname = usePathname();
	const organizationSlug = useOrganizationSlug();
	const resolveHref = React.useMemo(() => createMerchantNavHrefResolver(organizationSlug), [organizationSlug]);
	const resolveTrail = React.useCallback((currentPathname: string) => resolveMerchantTrail(currentPathname, resolveHref), [resolveHref]);

	return (
		<BreadcrumbProvider pathname={pathname} revalidateKey={organizationSlug ?? ""} resolve={resolveTrail}>
			{children}
		</BreadcrumbProvider>
	);
}

export { MerchantBreadcrumbProvider, useBreadcrumb as useMerchantBreadcrumb };
