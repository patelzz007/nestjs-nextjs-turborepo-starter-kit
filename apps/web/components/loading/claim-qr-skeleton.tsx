import { CLAIM_QR_SIZE_PX } from "@/components/rewardhub/claims/claim-qr-layout";
import { CLAIM_QR_LOADING_LABELS } from "@/components/loading/loading-labels";
import { RewardHubBackLinkSkeleton, RewardHubPageHeaderSkeleton } from "@/components/loading/reward-hub-page-header-skeleton";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { Card } from "@workspace/ui/components/card";
import * as React from "react";

/** The QR's footprint: `QrCode`'s padded, bordered frame around a square of the view's size. */
const QR_SQUARE_STYLE: React.CSSProperties = { width: CLAIM_QR_SIZE_PX, height: CLAIM_QR_SIZE_PX };

/**
 * `ClaimQrView`: header, back link, then the redemption panel — QR code and
 * caption, backup-code box, manual-payload disclosure, validity line and the
 * refresh button. Its own loading surface, used by the route and the view.
 */
export function ClaimQrSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={CLAIM_QR_LOADING_LABELS}>
			<div className="mx-auto max-w-4xl space-y-8">
				<RewardHubPageHeaderSkeleton />
				<RewardHubBackLinkSkeleton />
				<Card className="gap-0 p-5 sm:p-6">
					<div className="mb-6 flex flex-col items-center gap-3">
						<div className="inline-flex rounded-xl border border-border p-4 shadow-sm">
							<Skeleton style={QR_SQUARE_STYLE} />
						</div>
						<Skeleton variant="text" className="my-0.5 h-4 w-72 max-w-full" />
					</div>
					<div className="space-y-4">
						<div className="flex flex-col items-center rounded-lg border border-border bg-background p-4">
							<Skeleton variant="text" className="my-0.5 h-3 w-24" />
							<Skeleton className="mt-2.5 mb-0.5 h-7 w-44" />
							<Skeleton variant="text" className="mt-1.5 mb-0.5 h-3 w-48" />
						</div>
						<Skeleton className="h-11 w-full rounded-lg" />
						<Skeleton variant="text" className="my-0.5 h-4 w-56" />
						<Skeleton className="h-10 w-full sm:w-32" />
					</div>
				</Card>
			</div>
		</SkeletonRegion>
	);
}
