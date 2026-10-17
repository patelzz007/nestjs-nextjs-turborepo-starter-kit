import { REFERRALS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { RewardHubPageHeaderSkeleton } from "@/components/loading/reward-hub-page-header-skeleton";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import { Card } from "@workspace/ui/components/card";
import * as React from "react";

/** A first screen of referees — enough to read as a list without implying how many there are. */
const REFEREE_SKELETON_ROWS = 3;

const REFEREE_NAME_WIDTHS: readonly string[] = ["w-36", "w-44", "w-32"];

/** The code panel's contents: the code-state message, "Your referral code" and the code itself, the copy control. Bones only. */
export function ReferralCodeBones(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-5">
			<div className="flex max-w-md flex-col gap-2 py-1">
				<Skeleton variant="text" className="h-3.5 w-full" />
				<Skeleton variant="text" className="h-3.5 w-3/5" />
			</div>
			<div className="flex flex-wrap items-end gap-4">
				<div className="flex flex-col gap-1">
					<Skeleton variant="text" className="my-0.5 h-3 w-28" />
					<Skeleton className="my-1 h-7 w-64 max-w-full sm:h-8" />
				</div>
				<Skeleton className="h-9 w-28" />
			</div>
		</div>
	);
}

/** The "Registered with your code" rows — name and joined date, then the status badge. Bones only. */
export function RefereeRowsBones(): React.JSX.Element {
	return (
		<div className="divide-y divide-border">
			{placeholderKeys("referee", REFEREE_SKELETON_ROWS).map((key, index) => (
				<div key={key} data-slot="referee-row-skeleton" className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
					<div className="flex flex-col gap-1">
						<Skeleton variant="text" className={cn("my-1 h-4", cycledWidth(REFEREE_NAME_WIDTHS, index, "w-36"))} />
						<Skeleton variant="text" className="my-0.5 h-3 w-40" />
					</div>
					<Skeleton variant="text" className="h-5 w-20" />
				</div>
			))}
		</div>
	);
}

/** `/rewardhub/referrals` while the server prefetches the code dashboard and the first page of referees. */
export function ReferralsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={REFERRALS_LOADING_LABELS} className="flex flex-col gap-10">
			<RewardHubPageHeaderSkeleton />
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<Card className="gap-0 border border-dashed border-primary/30 p-6 ring-0 sm:p-8">
					<ReferralCodeBones />
				</Card>
				<Card className="justify-between gap-4 p-6">
					<div className="flex flex-col gap-1">
						<Skeleton variant="text" className="my-0.5 h-4 w-52" />
						<Skeleton className="my-0.5 h-8 w-14" />
					</div>
					<div className="flex flex-col gap-2 py-1">
						<Skeleton variant="text" className="h-3.5 w-full" />
						<Skeleton variant="text" className="h-3.5 w-2/3" />
					</div>
				</Card>
			</div>
			<Card className="gap-0 p-0">
				<div className="border-b border-border px-6 py-4">
					<Skeleton variant="text" className="my-0.5 h-5 w-52" />
				</div>
				<RefereeRowsBones />
			</Card>
		</SkeletonRegion>
	);
}
