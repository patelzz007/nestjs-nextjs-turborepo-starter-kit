import { TenantStoresPageView } from "@/contexts/tenancy/components/org/tenant-stores-page-view";
import { guardOrgPage } from "@/contexts/tenancy/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TenantStoresPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Every store the member belongs to — open in `ORG_PAGE_RULES` (the API lists only the caller's own memberships). */
export default async function TenantStoresPage({ params }: TenantStoresPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardOrgPage(tenantSlug, "/stores");
	if (denied !== null) {
		return denied;
	}

	return <TenantStoresPageView tenantSlug={tenantSlug} />;
}
