import { MerchantDashboardPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]` (which opens the dashboard) inside the mounted merchant shell. */
export default function MerchantOrganizationLoading(): React.JSX.Element {
	return <MerchantDashboardPageSkeleton />;
}
