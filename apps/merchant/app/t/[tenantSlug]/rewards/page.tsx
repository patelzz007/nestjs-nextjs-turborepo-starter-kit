import { MerchantRewardsPageView } from "@/contexts/rewards/components/merchant-rewards-page-view";
import { guardOrgPage } from "@/contexts/tenancy/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantRewardsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Merchant rewards catalog — client-fetched so location scope and cache stay consistent. */
export default async function MerchantRewardsPage({ params }: MerchantRewardsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardOrgPage(tenantSlug, "/rewards");
	if (denied !== null) {
		return denied;
	}

	return <MerchantRewardsPageView tenantSlug={tenantSlug} />;
}
