import { MerchantEditBroadcastPageView } from "@/contexts/notifications/components/merchant-broadcast-editor-pages";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantEditBroadcastPageProps {
	readonly params: Promise<{ tenantSlug: string; broadcastId: string }>;
}

/** A draft broadcast's composer. */
export default async function MerchantEditBroadcastPage({ params }: MerchantEditBroadcastPageProps): Promise<React.JSX.Element> {
	const { tenantSlug, broadcastId } = await params;
	const denied = await guardTenantPage(tenantSlug, "/broadcasts/[broadcastId]/edit");
	if (denied !== null) {
		return denied;
	}
	return <MerchantEditBroadcastPageView tenantSlug={tenantSlug} broadcastId={broadcastId} />;
}
