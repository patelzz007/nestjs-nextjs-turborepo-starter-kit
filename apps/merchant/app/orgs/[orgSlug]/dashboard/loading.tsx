import { MerchantDashboardPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/orgs/[orgSlug]/dashboard` while the server loads the organization context. */
export default function MerchantDashboardLoading(): React.JSX.Element {
	return <MerchantDashboardPageSkeleton />;
}
