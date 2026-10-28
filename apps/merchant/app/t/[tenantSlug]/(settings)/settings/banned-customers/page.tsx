import { TenantBannedCustomersPageView } from "@/contexts/tenancy/components/customer-bans/tenant-banned-customers-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TenantBannedCustomersPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** The tenant's active customer bans, each liftable — `merchant:manage_rewards`. */
export default async function TenantBannedCustomersPage({ params }: TenantBannedCustomersPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/settings/banned-customers");
	if (denied !== null) {
		return denied;
	}

	return <TenantBannedCustomersPageView tenantSlug={tenantSlug} />;
}
