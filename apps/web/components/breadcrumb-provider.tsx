"use client";

import * as React from "react";

import { usePathname } from "next/navigation";

import { createBreadcrumbContext } from "@workspace/ui/components/breadcrumb-context";

import { resolveWebTrail } from "@/lib/breadcrumb";

/**
 * The web app's single BreadcrumbContext instance — created from the shared
 * factory with the web-specific route resolver. `WebBreadcrumbProvider` is a
 * thin client wrapper that feeds `usePathname()` into the framework-free
 * provider, so the root layout (a server component) can mount it directly.
 */
const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolveWebTrail);

interface WebBreadcrumbProviderProps {
	readonly children: React.ReactNode;
}

function WebBreadcrumbProvider({ children }: WebBreadcrumbProviderProps): React.JSX.Element {
	const pathname = usePathname();
	return <BreadcrumbProvider pathname={pathname}>{children}</BreadcrumbProvider>;
}

export { WebBreadcrumbProvider, useBreadcrumb as useWebBreadcrumb };
