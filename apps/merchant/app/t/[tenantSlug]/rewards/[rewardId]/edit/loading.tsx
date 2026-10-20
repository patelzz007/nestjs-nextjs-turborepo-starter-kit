import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/rewards/[rewardId]/edit` while the server prefetches the reward. */
export default function MerchantEditRewardLoading(): React.JSX.Element {
	return <MerchantRewardEditorPageSkeleton />;
}
