import { MerchantBannedCustomersPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/settings/banned-customers` while the page guard runs. */
export default function MerchantBannedCustomersLoading(): React.JSX.Element {
	return <MerchantBannedCustomersPageSkeleton />;
}
