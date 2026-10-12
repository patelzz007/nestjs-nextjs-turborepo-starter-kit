import { ActivityPageSkeleton } from "@/components/loading/activity-skeleton";
import * as React from "react";

/** `/rewardhub/activity` while the server prefetches the analytics dashboard. */
export default function RewardHubActivityLoading(): React.JSX.Element {
	return <ActivityPageSkeleton />;
}
