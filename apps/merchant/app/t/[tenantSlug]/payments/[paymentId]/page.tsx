import { MerchantPaymentDetailPageView } from "@/contexts/payments/components/merchant-payment-detail-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantPaymentDetailPageProps {
	readonly params: Promise<{ tenantSlug: string; paymentId: string }>;
}

/** One payment (ADR 020). */
export default async function MerchantPaymentDetailPage({ params }: MerchantPaymentDetailPageProps): Promise<React.JSX.Element> {
	const { tenantSlug, paymentId } = await params;
	const denied = await guardTenantPage(tenantSlug, "/payments/[paymentId]");
	if (denied !== null) {
		return denied;
	}
	return <MerchantPaymentDetailPageView tenantSlug={tenantSlug} paymentId={paymentId} />;
}
