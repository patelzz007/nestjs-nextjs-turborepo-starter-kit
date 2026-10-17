import { REWARD_DETAIL_LOADING_LABELS } from "@/components/loading/loading-labels";
import { AspectRatio } from "@workspace/ui/components/aspect-ratio";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { Card } from "@workspace/ui/components/card";
import * as React from "react";
import { REWARD_CARD_COVER_RATIO } from "@/lib/rewards/reward-cover";

/** `RewardClaimFlow`'s phone step: "Mobile number" label over its input, then the primary action. Bones only. */
export function ClaimFlowBones(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Skeleton variant="text" className="h-3.5 w-28" />
				<Skeleton className="h-9 w-full" />
			</div>
			<Skeleton className="h-10 w-28" />
		</div>
	);
}

/** `RewardDetailView`: the gallery (then how it works) beside the offer panel (merchant, badges, title, offer, copy, stock) and the claim panel. Bones only. */
export function RewardDetailBones(): React.JSX.Element {
	return (
		<div className="@container space-y-12">
			<div className="grid gap-8 @4xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @4xl:items-start">
				<div className="space-y-10">
					<AspectRatio ratio={REWARD_CARD_COVER_RATIO}>
						<Skeleton className="absolute inset-0 rounded-2xl" />
					</AspectRatio>
					<div className="space-y-4">
						<Skeleton variant="text" className="my-1 h-5 w-32" />
						<div className="grid gap-3 sm:grid-cols-3">
							<Skeleton className="h-36 rounded-xl" />
							<Skeleton className="h-36 rounded-xl" />
							<Skeleton className="h-36 rounded-xl" />
						</div>
					</div>
				</div>
				<div className="space-y-6">
					<Card className="gap-0 p-5 sm:p-6">
						<div className="flex items-center gap-3">
							<Skeleton className="size-12 rounded-xl" />
							<div className="flex min-w-0 flex-col gap-1">
								<Skeleton variant="text" className="my-0.5 h-3 w-16" />
								<Skeleton variant="text" className="my-0.5 h-4 w-40" />
							</div>
						</div>
						<div className="mt-5 flex flex-wrap gap-2">
							<Skeleton variant="text" className="h-5 w-16" />
							<Skeleton variant="text" className="h-5 w-20" />
						</div>
						<Skeleton variant="text" className="mt-3 h-8 w-4/5" />
						<Skeleton variant="text" className="mt-3 h-6 w-28" />
						<Skeleton variant="text" className="mt-4 h-4 w-full" />
						<Skeleton variant="text" className="mt-2 h-4 w-2/3" />
						<div className="mt-5 space-y-4 border-t border-border pt-5">
							<Skeleton className="h-6 w-full" />
							<Skeleton variant="text" className="h-4 w-48" />
						</div>
					</Card>
					<Card className="gap-0 p-5 sm:p-6">
						<Skeleton variant="text" className="my-0.5 h-5 w-36" />
						<div className="mt-4">
							<ClaimFlowBones />
						</div>
					</Card>
				</div>
			</div>
		</div>
	);
}

/** A reward's detail page (signed-in or public) while the reward loads. */
export function RewardDetailSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={REWARD_DETAIL_LOADING_LABELS}>
			<RewardDetailBones />
		</SkeletonRegion>
	);
}
