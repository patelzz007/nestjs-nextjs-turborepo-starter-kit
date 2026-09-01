import { MerchantEditRewardPageView } from "@/components/rewards/merchant-edit-reward-page-view";
import { loadMerchantServerContext } from "@/lib/merchant-server-api";
import type { RewardResponse } from "@workspace/shared";
import * as React from "react";

export const dynamic = "force-dynamic";

export default async function MerchantRewardDetailPage({ params }: { readonly params: Promise<{ rewardId: string }> }): Promise<React.JSX.Element> {
	const { rewardId } = await params;
	const { server, merchantHeaders } = await loadMerchantServerContext();

	let initialRewards: readonly RewardResponse[] | undefined;
	try {
		const response = await server.merchant.rewards.list.query({}, { headers: merchantHeaders });
		initialRewards = response.data;
	} catch {
		initialRewards = undefined;
	}

	return <MerchantEditRewardPageView rewardId={rewardId} initialRewards={initialRewards} />;
}
