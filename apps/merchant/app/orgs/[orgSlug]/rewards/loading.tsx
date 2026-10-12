import { MerchantRewardsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/rewards` while the page guard runs. */
export default function MerchantRewardsLoading(): React.JSX.Element {
	return <MerchantRewardsPageSkeleton />;
}
