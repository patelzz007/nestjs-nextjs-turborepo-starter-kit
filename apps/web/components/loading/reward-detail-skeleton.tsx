import { REWARD_DETAIL_LOADING_LABELS } from "@/components/loading/loading-labels";
import { RewardHubBackLinkSkeleton, RewardHubPageHeaderSkeleton } from "@/components/loading/reward-hub-page-header-skeleton";
import { WebSurfacePanel } from "@/components/web-ui/surface-panel";
import { AspectRatio } from "@workspace/ui/components/aspect-ratio";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
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

/** `RewardDetailView`: header, back link, the cover beside the offer panel (merchant, badges, stock line) and the claim panel. Bones only. */
export function RewardDetailBones(): React.JSX.Element {
	return (
		<div className="space-y-8">
			<RewardHubPageHeaderSkeleton />
			<RewardHubBackLinkSkeleton />
			<div className="@container">
				<div className="grid gap-6 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:items-start">
					<AspectRatio ratio={REWARD_CARD_COVER_RATIO}>
						<Skeleton className="absolute inset-0 rounded-2xl" />
					</AspectRatio>
					<div className="space-y-6">
						<WebSurfacePanel className="p-5 sm:p-6">
							<div className="mb-4 flex items-center gap-3">
								<Skeleton className="size-16 rounded-xl" />
								<div className="flex min-w-0 flex-col gap-1">
									<Skeleton variant="text" className="my-0.5 h-3 w-16" />
									<Skeleton variant="text" className="my-1 h-4 w-40" />
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<Skeleton variant="text" className="h-5 w-16" />
								<Skeleton variant="text" className="h-5 w-20" />
							</div>
							<Skeleton variant="text" className="mt-4 mb-1 h-4 w-64 max-w-full" />
						</WebSurfacePanel>
						<WebSurfacePanel className="p-5 sm:p-6">
							<Skeleton variant="text" className="my-0.5 h-5 w-36" />
							<div className="mt-4">
								<ClaimFlowBones />
							</div>
						</WebSurfacePanel>
					</div>
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
