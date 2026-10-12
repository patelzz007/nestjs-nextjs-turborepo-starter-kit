import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PageHeaderSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type * as React from "react";

import { PENDING_REWARDS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { BadgeSkeleton, CardHeadingSkeleton } from "@/components/loading/skeleton-parts";

/** Reward cards drawn while the moderation queue loads. */
const PENDING_REWARD_SKELETON_ITEMS = 3;
/** Merchant, reward type, status. */
const PENDING_REWARD_BADGES = 3;
/** Quantity, expires, category, reward id. */
const PENDING_REWARD_FACTS = 4;

/** The moderation queue's reward cards: the 16:9 cover beside (stacked above, when narrow) title, description, badges, approve/reject and the four-fact row. */
export function PendingRewardItemsSkeleton(): React.JSX.Element {
	return (
		<>
			{placeholderKeys("reward", PENDING_REWARD_SKELETON_ITEMS).map((key) => (
				<div
					key={key}
					data-skeleton="pending-reward"
					className="grid gap-4 rounded-lg border p-4 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
					<Skeleton data-skeleton="pending-reward-cover" className="aspect-video w-full self-start" />
					<div className="flex min-w-0 flex-col gap-4">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="flex min-w-0 flex-col gap-2">
								<Skeleton variant="text" className="h-4 w-48" />
								<Skeleton variant="text" className="h-3.5 w-72 max-w-full" />
								<div className="flex flex-wrap gap-2 pt-1">
									{placeholderKeys("badge", PENDING_REWARD_BADGES).map((badgeKey) => (
										<BadgeSkeleton key={badgeKey} />
									))}
								</div>
							</div>
							<div className="flex shrink-0 gap-2">
								<Skeleton className="h-8 w-24" />
								<Skeleton className="h-8 w-20" />
							</div>
						</div>
						<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
							{placeholderKeys("fact", PENDING_REWARD_FACTS).map((factKey) => (
								<div key={factKey} className="flex flex-col gap-1.5">
									<Skeleton variant="text" className="h-3 w-16" />
									<Skeleton variant="text" className="h-3 w-24" />
								</div>
							))}
						</div>
					</div>
				</div>
			))}
		</>
	);
}

/** `/rewards/review`: header, then the moderation queue card of reward cards. */
export function PendingRewardsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={PENDING_REWARDS_LOADING_LABELS} className="flex flex-col gap-6">
			<PageHeaderSkeleton />
			<Card>
				<CardHeader>
					<CardHeadingSkeleton />
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<PendingRewardItemsSkeleton />
				</CardContent>
			</Card>
		</SkeletonRegion>
	);
}
