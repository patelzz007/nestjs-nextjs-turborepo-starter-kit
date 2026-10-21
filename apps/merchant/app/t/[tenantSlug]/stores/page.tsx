import { TenantStoresPageView } from "@/contexts/tenancy/components/tenant/tenant-stores-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TenantStoresPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Every store the member belongs to — open in `ORG_PAGE_RULES` (the API lists only the caller's own memberships). */
export default async function TenantStoresPage({ params }: TenantStoresPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/stores");
	if (denied !== null) {
		return denied;
	}

	return <TenantStoresPageView tenantSlug={tenantSlug} />;
}
