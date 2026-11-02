"use client";

import { useMerchantBreadcrumb } from "@/components/common/merchant-breadcrumb";
import MerchantCommandPaletteClientOnly from "@/components/layout/merchant-command-palette.client-only";
import { useTenantSlug } from "@/contexts/tenancy/lib/tenant/use-tenant-slug";
import { ROUTES, tenantRoutes } from "@/lib/routes";
import { ShellTopbar } from "@workspace/client/lib/features/navigation/shell-topbar";
import type * as React from "react";

/**
 * The merchant portal's page header: the shared `ShellTopbar` with this app's breadcrumb trail and
 * command palette. The store and location switcher heads the sidebar (`MerchantContextSwitcher`);
 * theme, settings and the profile menu live in the sidebar's account row.
 */
export function MerchantTopbar(): React.JSX.Element {
	const { status } = useMerchantBreadcrumb();
	const tenantSlug = useTenantSlug();
	// Inside a tenant the inbox opens in place; elsewhere the entry route resolves a tenant first.
	const notificationsHref = tenantSlug === undefined ? ROUTES.notifications : tenantRoutes(tenantSlug).notifications;
	return <ShellTopbar breadcrumbStatus={status} commandPalette={MerchantCommandPaletteClientOnly} notificationsHref={notificationsHref} />;
}
