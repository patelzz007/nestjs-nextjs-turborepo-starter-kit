import { WebhookEndpointDetailView } from "@/contexts/webhooks/components/webhook-endpoint-detail-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface WebhookEndpointPageProps {
	readonly params: Promise<{ tenantSlug: string; endpointId: string }>;
}

/** One webhook endpoint, read-only, with its delivery log (the "endpoint turned off" notice links here). */
export default async function WebhookEndpointPage({ params }: WebhookEndpointPageProps): Promise<React.JSX.Element> {
	const { tenantSlug, endpointId } = await params;
	const denied = await guardTenantPage(tenantSlug, "/webhooks/[endpointId]");
	if (denied !== null) {
		return denied;
	}
	return <WebhookEndpointDetailView tenantSlug={tenantSlug} endpointId={endpointId} />;
}
