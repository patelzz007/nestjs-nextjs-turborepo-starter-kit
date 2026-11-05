import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/payments/new` while the page guard runs. */
export default function MerchantNewPaymentLoading(): React.JSX.Element {
	return <MerchantRewardEditorPageSkeleton />;
}
