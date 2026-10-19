import { RewardDetailSkeleton } from "@/components/loading/reward-detail-skeleton";
import * as React from "react";

import { PublicRewardDetailFrame } from "../../../contexts/rewards/components/detail/public-reward-detail-frame";

/** `/rewards/[rewardId]` while the server loads the reward — the real landing chrome and back link around the detail skeleton. */
export default function PublicRewardDetailLoading(): React.JSX.Element {
	return (
		<PublicRewardDetailFrame>
			<RewardDetailSkeleton />
		</PublicRewardDetailFrame>
	);
}
