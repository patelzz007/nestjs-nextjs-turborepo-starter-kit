import { WebhookEndpointEditView } from "@/contexts/webhooks/components/webhook-endpoint-edit-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface EditWebhookEndpointPageProps {
	readonly params: Promise<{ tenantSlug: string; endpointId: string }>;
}

/** The webhook endpoint editor. */
export default async function EditWebhookEndpointPage({ params }: EditWebhookEndpointPageProps): Promise<React.JSX.Element> {
	const { tenantSlug, endpointId } = await params;
	const denied = await guardTenantPage(tenantSlug, "/webhooks/[endpointId]/edit");
	if (denied !== null) {
		return denied;
	}
	return <WebhookEndpointEditView tenantSlug={tenantSlug} endpointId={endpointId} />;
}
