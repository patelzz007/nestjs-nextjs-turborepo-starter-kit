import { MerchantBroadcastsPageView } from "@/contexts/notifications/components/merchant-broadcasts-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantBroadcastsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** The store's broadcasts to its customers (ADR 073). */
export default async function MerchantBroadcastsPage({ params }: MerchantBroadcastsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/broadcasts");
	if (denied !== null) {
		return denied;
	}
	return <MerchantBroadcastsPageView tenantSlug={tenantSlug} />;
}
