import { MerchantRewardsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/payments` while the page guard runs. */
export default function MerchantPaymentsLoading(): React.JSX.Element {
	return <MerchantRewardsPageSkeleton />;
}
