import { MerchantRewardsPageView } from "@/components/rewards/merchant-rewards-page-view";
import * as React from "react";

export const dynamic = "force-dynamic";

interface MerchantRewardsPageProps {
	readonly params: Promise<{ orgSlug: string }>;
}

/** Merchant rewards catalog — client-fetched so location scope and cache stay consistent. */
export default async function MerchantRewardsPage({ params }: MerchantRewardsPageProps): Promise<React.JSX.Element> {
	const { orgSlug } = await params;

	return <MerchantRewardsPageView orgSlug={orgSlug} />;
}
