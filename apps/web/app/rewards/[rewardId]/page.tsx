import { RewardDetailView } from "@/components/rewardhub/detail/view";
import { loadRewardDetail } from "@/lib/rewards/reward-detail-server";
import * as React from "react";

import { PublicRewardDetailFrame } from "./public-reward-detail-frame";

export const dynamic = "force-dynamic";

/** `/rewards/[rewardId]` — public (guest-browsable) reward detail; claiming asks the visitor to sign in. */
export default async function PublicRewardDetailPage({ params }: { readonly params: Promise<{ rewardId: string }> }): Promise<React.JSX.Element> {
	const { rewardId } = await params;
	const reward = await loadRewardDetail(rewardId);

	return (
		<PublicRewardDetailFrame>
			<RewardDetailView rewardId={reward.data.id} initialReward={reward} />
		</PublicRewardDetailFrame>
	);
}
