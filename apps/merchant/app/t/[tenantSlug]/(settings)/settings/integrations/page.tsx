import { TenantIntegrationsView } from "@/contexts/tenancy/components/settings/tenant-integrations-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TenantIntegrationsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Tills and API keys at a glance — `merchant:manage_api_keys`. */
export default async function TenantIntegrationsPage({ params }: TenantIntegrationsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/settings/integrations");
	if (denied !== null) {
		return denied;
	}
	return <TenantIntegrationsView tenantSlug={tenantSlug} />;
}
