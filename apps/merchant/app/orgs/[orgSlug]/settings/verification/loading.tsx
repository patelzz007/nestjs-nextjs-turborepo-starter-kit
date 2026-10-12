import { MerchantVerificationPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/settings/verification` while the page guard runs. */
export default function MerchantVerificationLoading(): React.JSX.Element {
	return <MerchantVerificationPageSkeleton />;
}
