"use client";

import { createBreadcrumbContext } from "@workspace/ui/components/navigation/breadcrumb-context";
import { usePathname } from "next/navigation";
import * as React from "react";

import { resolveMerchantTrail } from "@/lib/navigation/breadcrumb";

const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolveMerchantTrail);

interface MerchantBreadcrumbProviderProps {
	readonly children: React.ReactNode;
}

function MerchantBreadcrumbProvider({ children }: MerchantBreadcrumbProviderProps): React.JSX.Element {
	const pathname = usePathname();
	return <BreadcrumbProvider pathname={pathname}>{children}</BreadcrumbProvider>;
}

export { MerchantBreadcrumbProvider, useBreadcrumb as useMerchantBreadcrumb };
