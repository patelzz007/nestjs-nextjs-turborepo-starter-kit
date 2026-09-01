"use client";

import { createBreadcrumbContext } from "@workspace/ui/components/navigation/breadcrumb-context";
import { usePathname } from "next/navigation";
import * as React from "react";

import { resolveWebTrail } from "@/lib/navigation/breadcrumb";

const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolveWebTrail);

interface WebBreadcrumbProviderProps {
	readonly children: React.ReactNode;
}

function WebBreadcrumbProvider({ children }: WebBreadcrumbProviderProps): React.JSX.Element {
	const pathname = usePathname();
	return <BreadcrumbProvider pathname={pathname}>{children}</BreadcrumbProvider>;
}

export { WebBreadcrumbProvider, useBreadcrumb as useWebBreadcrumb };
