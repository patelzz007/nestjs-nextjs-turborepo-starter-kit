import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/broadcasts/[broadcastId]/edit` while the page guard runs. */
export default function MerchantEditBroadcastLoading(): React.JSX.Element {
	return <MerchantRewardEditorPageSkeleton />;
}
