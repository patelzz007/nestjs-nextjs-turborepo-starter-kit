import { MerchantRewardDetailPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/broadcasts/[broadcastId]` while the page guard runs. */
export default function MerchantBroadcastDetailLoading(): React.JSX.Element {
	return <MerchantRewardDetailPageSkeleton />;
}
