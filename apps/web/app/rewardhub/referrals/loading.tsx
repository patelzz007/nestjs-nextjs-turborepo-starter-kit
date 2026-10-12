import { ReferralsPageSkeleton } from "@/components/loading/referrals-skeleton";
import * as React from "react";

/** `/rewardhub/referrals` while the server prefetches the code dashboard and referees. */
export default function RewardHubReferralsLoading(): React.JSX.Element {
	return <ReferralsPageSkeleton />;
}
