import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PageHeaderSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type * as React from "react";

import { PENDING_REWARDS_LOADING_LABELS, REWARD_LOADING_LABELS } from "@/components/loading/loading-labels";
import { BadgeSkeleton, CardHeadingSkeleton } from "@/components/loading/skeleton-parts";

/** Queue rows drawn while the moderation queue loads. */
const PENDING_REWARD_SKELETON_ITEMS = 3;
/** Offer, type, category, quantity, starts, expires, stores, minimum spend, uses per customer, referrals, reward id. */
const REWARD_DETAIL_FACTS = 11;

/** The moderation queue's rows: a small 16:9 thumbnail, the title over the merchant, and "View more". */
export function PendingRewardItemsSkeleton(): React.JSX.Element {
	return (
		<ul className="flex flex-col gap-3">
			{placeholderKeys("reward", PENDING_REWARD_SKELETON_ITEMS).map((key) => (
				<li key={key} data-skeleton="pending-reward" className="flex items-center gap-3 rounded-lg border p-3 sm:gap-4">
					<Skeleton data-skeleton="pending-reward-cover" className="aspect-video w-20 shrink-0 sm:w-28" />
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Skeleton variant="text" className="h-4 w-48 max-w-full" />
						<Skeleton variant="text" className="h-3.5 w-32 max-w-full" />
					</div>
					<Skeleton className="h-9 w-24 shrink-0" />
				</li>
			))}
		</ul>
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

/** `/rewards/review/[id]`: back link, header (status, title, merchant, decisions), then photos and copy beside the details card. */
export function RewardReviewDetailPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={REWARD_LOADING_LABELS} className="mx-auto flex w-full max-w-10xl flex-col gap-6">
			<Skeleton className="h-9 w-32" />
			<div data-skeleton="reward-review-header" className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex min-w-0 flex-col gap-3">
					<BadgeSkeleton className="w-24" />
					<Skeleton variant="text" className="h-7 w-80 max-w-full" />
					<div className="flex items-center gap-2">
						<Skeleton className="size-8 rounded-full" />
						<Skeleton variant="text" className="h-3.5 w-40" />
					</div>
				</div>
				<div className="flex shrink-0 gap-2">
					<Skeleton className="h-10 w-28" />
					<Skeleton className="h-10 w-24" />
				</div>
			</div>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
				<div className="flex min-w-0 flex-col gap-6">
					<Card>
						<CardHeader>
							<CardHeadingSkeleton withDescription={false} />
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<Skeleton data-skeleton="reward-review-photo" className="aspect-video w-full" />
							<div className="flex flex-wrap items-center justify-between gap-3">
								<Skeleton variant="text" className="h-3.5 w-48" />
								<div className="flex gap-2">
									<Skeleton className="h-9 w-32" />
									<Skeleton className="h-9 w-28" />
								</div>
							</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardHeadingSkeleton withDescription={false} />
						</CardHeader>
						<CardContent className="flex flex-col gap-2">
							<Skeleton variant="text" className="h-3.5 w-full" />
							<Skeleton variant="text" className="h-3.5 w-4/5" />
						</CardContent>
					</Card>
				</div>
				<Card className="self-start">
					<CardHeader>
						<CardHeadingSkeleton withDescription={false} />
					</CardHeader>
					<CardContent data-skeleton="reward-review-details" className="flex flex-col gap-4">
						{placeholderKeys("fact", REWARD_DETAIL_FACTS).map((key) => (
							<div key={key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3">
								<Skeleton variant="text" className="h-3.5 w-24" />
								<Skeleton variant="text" className="h-3.5 w-3/4" />
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</SkeletonRegion>
	);
}
