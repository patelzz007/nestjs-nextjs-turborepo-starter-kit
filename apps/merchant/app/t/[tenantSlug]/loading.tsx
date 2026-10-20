import { MerchantDashboardPageSkeleton } from "@/components/loading/merchant-page-skeletons";
import type * as React from "react";

/** `/t/[tenantSlug]` (which opens the dashboard) inside the mounted merchant shell. */
export default function MerchantTenantLoading(): React.JSX.Element {
	return <MerchantDashboardPageSkeleton />;
}
