import { MerchantVerificationPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/settings/verification` while the page guard runs. */
export default function MerchantVerificationLoading(): React.JSX.Element {
	return <MerchantVerificationPageSkeleton />;
}
