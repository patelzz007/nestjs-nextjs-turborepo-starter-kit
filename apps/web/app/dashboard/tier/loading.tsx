import * as React from "react";

import { TierPageSkeleton } from "@/components/loading/tier-skeleton";

/** `/dashboard/tier` while the server reads the customer's tier. */
export default function DashboardTierLoading(): React.JSX.Element {
	return <TierPageSkeleton />;
}
