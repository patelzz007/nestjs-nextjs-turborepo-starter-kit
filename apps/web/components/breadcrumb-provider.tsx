"use client";

import { createBreadcrumbContext } from "@workspace/ui/components/navigation/breadcrumb-context";
import { usePathname } from "next/navigation";
import * as React from "react";

import { resolveWebTrail } from "@/lib/navigation/breadcrumb";

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
	return <BreadcrumbProvider pathname={pathname}>{children}</BreadcrumbProvider>;
}

export { WebBreadcrumbProvider, useBreadcrumb as useWebBreadcrumb };
