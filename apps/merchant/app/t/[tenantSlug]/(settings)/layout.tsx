import { MerchantSettingsShell } from "@/contexts/tenancy/components/settings/merchant-settings-shell";
import * as React from "react";

interface TenantSettingsLayoutProps {
	readonly params: Promise<{ tenantSlug: string }>;
	readonly children: React.ReactNode;
}

/**
 * Every settings section shares one page: the sections on the left, the open one on the right. Each page still
 * guards itself. A route group, so `/settings/*` and `/account` (Security, the Personal section) sit under this ONE
 * layout: switching sections swaps only the section, and the navigation is never re-mounted.
 */
export default async function TenantSettingsLayout({ params, children }: TenantSettingsLayoutProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	return <MerchantSettingsShell tenantSlug={tenantSlug}>{children}</MerchantSettingsShell>;
}
