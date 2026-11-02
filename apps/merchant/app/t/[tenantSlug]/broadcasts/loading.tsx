import { MerchantRewardsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/broadcasts` while the page guard runs. */
export default function MerchantBroadcastsLoading(): React.JSX.Element {
	return <MerchantRewardsPageSkeleton />;
}
