import { MerchantLocationsPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/settings/locations` while the page guard runs. */
export default function MerchantLocationsLoading(): React.JSX.Element {
	return <MerchantLocationsPageSkeleton />;
}
