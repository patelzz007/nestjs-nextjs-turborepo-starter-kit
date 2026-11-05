import { MerchantNewPaymentPageView } from "@/contexts/payments/components/merchant-new-payment-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantNewPaymentPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Ask a customer for a payment (ADR 020). */
export default async function MerchantNewPaymentPage({ params }: MerchantNewPaymentPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/payments/new");
	if (denied !== null) {
		return denied;
	}
	return <MerchantNewPaymentPageView tenantSlug={tenantSlug} />;
}
