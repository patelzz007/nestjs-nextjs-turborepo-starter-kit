import { RewardDetailSkeleton } from "@/components/loading/reward-detail-skeleton";
import * as React from "react";

/** `/dashboard/rewards/[rewardId]` while the server loads the reward. */
export default function DashboardRewardDetailLoading(): React.JSX.Element {
	return <RewardDetailSkeleton />;
}
