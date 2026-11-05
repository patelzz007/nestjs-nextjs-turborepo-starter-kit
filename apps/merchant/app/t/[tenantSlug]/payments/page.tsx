import { MerchantPaymentsPageView } from "@/contexts/payments/components/merchant-payments-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantPaymentsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** The store's payments (ADR 020). */
export default async function MerchantPaymentsPage({ params }: MerchantPaymentsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/payments");
	if (denied !== null) {
		return denied;
	}
	return <MerchantPaymentsPageView tenantSlug={tenantSlug} />;
}
