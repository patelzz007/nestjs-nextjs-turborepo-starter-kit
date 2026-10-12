import { RewardDetailSkeleton } from "@/components/loading/reward-detail-skeleton";
import * as React from "react";

/** `/rewardhub/rewards/[rewardId]` while the server loads the reward. */
export default function RewardHubRewardDetailLoading(): React.JSX.Element {
	return <RewardDetailSkeleton />;
}
