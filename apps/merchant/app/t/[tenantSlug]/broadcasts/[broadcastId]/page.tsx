import { MerchantBroadcastDetailPageView } from "@/contexts/notifications/components/merchant-broadcast-detail-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantBroadcastDetailPageProps {
	readonly params: Promise<{ tenantSlug: string; broadcastId: string }>;
}

/** One broadcast: its state, audience, results and message. */
export default async function MerchantBroadcastDetailPage({ params }: MerchantBroadcastDetailPageProps): Promise<React.JSX.Element> {
	const { tenantSlug, broadcastId } = await params;
	const denied = await guardTenantPage(tenantSlug, "/broadcasts/[broadcastId]");
	if (denied !== null) {
		return denied;
	}
	return <MerchantBroadcastDetailPageView tenantSlug={tenantSlug} broadcastId={broadcastId} />;
}
