import { WebhooksPageView } from "@/contexts/webhooks/components/webhooks-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface WebhooksPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Outgoing webhooks (ADR 082): `guardTenantPage` denies any role without `merchant:manage_webhooks`. */
export default async function WebhooksPage({ params }: WebhooksPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/webhooks");
	if (denied !== null) {
		return denied;
	}
	return <WebhooksPageView tenantSlug={tenantSlug} />;
}
