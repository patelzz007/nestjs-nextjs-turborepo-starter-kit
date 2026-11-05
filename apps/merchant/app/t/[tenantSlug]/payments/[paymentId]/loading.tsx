import { MerchantRewardDetailPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/payments/[paymentId]` while the page guard runs. */
export default function MerchantPaymentDetailLoading(): React.JSX.Element {
	return <MerchantRewardDetailPageSkeleton />;
}
