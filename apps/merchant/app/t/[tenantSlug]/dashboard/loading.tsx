import { MerchantDashboardPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]/dashboard` while the server loads the tenant context. */
export default function MerchantDashboardLoading(): React.JSX.Element {
	return <MerchantDashboardPageSkeleton />;
}
