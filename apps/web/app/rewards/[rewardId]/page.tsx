import { RewardDetailView } from "@/contexts/rewards/components/detail/view";
import { loadRewardDetail } from "@/contexts/rewards/lib/reward-detail-server";
import { ROUTE_PREFIXES } from "@/lib/routes";
import * as React from "react";

import { PublicRewardDetailFrame } from "../../../contexts/rewards/components/detail/public-reward-detail-frame";

export const dynamic = "force-dynamic";

/** `/rewards/[rewardId]` — public (guest-browsable) reward detail; claiming asks the visitor to sign in. */
export default async function PublicRewardDetailPage({ params }: { readonly params: Promise<{ rewardId: string }> }): Promise<React.JSX.Element> {
	const { rewardId } = await params;
	const reward = await loadRewardDetail(rewardId);

	return (
		<PublicRewardDetailFrame>
			<RewardDetailView rewardId={reward.data.id} initialReward={reward} detailPathPrefix={ROUTE_PREFIXES.publicRewards} />
		</PublicRewardDetailFrame>
	);
}
