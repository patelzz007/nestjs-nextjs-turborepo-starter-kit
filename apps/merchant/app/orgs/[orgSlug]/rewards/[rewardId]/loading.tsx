import { MerchantRewardDetailPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/rewards/[rewardId]` while the server prefetches the reward. */
export default function MerchantRewardDetailLoading(): React.JSX.Element {
	return <MerchantRewardDetailPageSkeleton />;
}
