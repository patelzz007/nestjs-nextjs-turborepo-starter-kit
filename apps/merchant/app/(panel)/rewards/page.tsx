import { MerchantRewardsPageView } from "@/components/rewards/merchant-rewards-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { RewardResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

/** Merchant rewards catalog — server-prefetched for the initial HTML. */
export default async function MerchantRewardsPage(): Promise<React.JSX.Element> {
	const { server, merchantHeaders } = await loadMerchantServerContext();

	let initialRewards: readonly RewardResponse[] | undefined;
	try {
		const response = await server.merchant.rewards.list.query({}, { headers: merchantHeaders });
		initialRewards = response.data;
	} catch {
		initialRewards = undefined;
	}

	return <MerchantRewardsPageView initialRewards={initialRewards} />;
}
