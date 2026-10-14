import { MerchantRewardEditorPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/rewards/new` while the page guard runs. */
export default function MerchantCreateRewardLoading(): React.JSX.Element {
	return <MerchantRewardEditorPageSkeleton />;
}
