import { ActivityPageSkeleton } from "@/components/loading/activity-skeleton";
import * as React from "react";

/** `/dashboard/activity` while the server prefetches the analytics dashboard. */
export default function DashboardActivityLoading(): React.JSX.Element {
	return <ActivityPageSkeleton />;
}
