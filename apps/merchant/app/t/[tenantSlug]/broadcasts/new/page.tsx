import { MerchantNewBroadcastPageView } from "@/contexts/notifications/components/merchant-broadcast-editor-pages";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantNewBroadcastPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** The broadcast composer: one customer, a picked group, or all the store's customers. */
export default async function MerchantNewBroadcastPage({ params }: MerchantNewBroadcastPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/broadcasts/new");
	if (denied !== null) {
		return denied;
	}
	return <MerchantNewBroadcastPageView tenantSlug={tenantSlug} />;
}
