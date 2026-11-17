import { Card } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import * as React from "react";

import { DashboardPageHeaderSkeleton } from "@/components/loading/dashboard-page-header-skeleton";
import { TIER_LOADING_LABELS } from "@/components/loading/loading-labels";

/** `/dashboard/tier` while the server reads the customer's tier: the header, the progress card, two side cards, the history. */
export function TierPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={TIER_LOADING_LABELS} className="flex flex-col gap-6">
			<DashboardPageHeaderSkeleton />
			<Card className="flex flex-col gap-4 p-6">
				<Skeleton variant="text" className="h-5 w-64" />
				<Skeleton variant="text" className="h-3.5 w-48" />
				<Skeleton className="h-2 w-full" />
			</Card>
			<div className="grid gap-6 lg:grid-cols-2">
				<Card className="flex flex-col gap-3 p-6">
					<Skeleton variant="text" className="h-5 w-52" />
					<Skeleton className="h-24 w-full" />
				</Card>
				<Card className="flex flex-col gap-3 p-6">
					<Skeleton variant="text" className="h-5 w-44" />
					<Skeleton className="h-24 w-full" />
				</Card>
			</div>
			<Card className="flex flex-col gap-3 p-6">
				<Skeleton variant="text" className="h-5 w-32" />
				<Skeleton className="h-20 w-full" />
			</Card>
		</SkeletonRegion>
	);
}
