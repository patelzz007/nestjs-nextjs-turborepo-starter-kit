import { MerchantRewardsPageView } from "@/components/rewards/merchant-rewards-page-view";
import { guardOrgPage } from "@/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantRewardsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/** Merchant rewards catalog — client-fetched so location scope and cache stay consistent. */
export default async function MerchantRewardsPage({ params }: MerchantRewardsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;
	const denied = await guardOrgPage(orgSlug, "/rewards");
	if (denied !== null) {
		return denied;
	}

	return <MerchantRewardsPageView orgSlug={orgSlug} />;
}
