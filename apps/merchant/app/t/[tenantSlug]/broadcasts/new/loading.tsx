import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/broadcasts/new` while the page guard runs. */
export default function MerchantNewBroadcastLoading(): React.JSX.Element {
	return <MerchantRewardEditorPageSkeleton />;
}
