import { ReferralsPageSkeleton } from "@/components/loading/referrals-skeleton";
import * as React from "react";

/** `/dashboard/referrals` while the server prefetches the code dashboard and referees. */
export default function DashboardReferralsLoading(): React.JSX.Element {
	return <ReferralsPageSkeleton />;
}
