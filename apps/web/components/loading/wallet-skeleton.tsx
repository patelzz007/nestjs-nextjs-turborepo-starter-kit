import { WALLET_LOADING_LABELS } from "@/components/loading/loading-labels";
import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { RewardHubPageHeaderSkeleton } from "@/components/loading/reward-hub-page-header-skeleton";
import { WebSurfacePanel } from "@/components/web-ui/surface-panel";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { StatCardsSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** A first screen of claims — the wallet's page holds more, but this many fill the view without implying a count. */
const WALLET_CLAIM_SKELETON_ROWS = 4;
/** The wallet's two account-wide stats: total claims, ready to redeem. */
const WALLET_STAT_COUNT = 2;

const CLAIM_TITLE_WIDTHS: readonly string[] = ["w-48", "w-60", "w-40", "w-56"];

/** The wallet's claim rows — reward title and claimed date, then the status badge and "Show QR". Bones only. */
export function WalletClaimRowsBones(): React.JSX.Element {
	return (
		<div className="space-y-3">
			{placeholderKeys("claim", WALLET_CLAIM_SKELETON_ROWS).map((key, index) => (
				<WebSurfacePanel key={key} className="px-5 py-4">
					<div data-slot="wallet-claim-row-skeleton" className="flex flex-wrap items-center justify-between gap-4">
						<div className="flex min-w-0 flex-col gap-1">
							<Skeleton variant="text" className={cn("my-1 h-4 max-w-full", cycledWidth(CLAIM_TITLE_WIDTHS, index, "w-48"))} />
							<Skeleton variant="text" className="my-0.5 h-4 w-44" />
						</div>
						<div className="flex items-center gap-2">
							<Skeleton variant="text" className="h-5 w-20" />
							<Skeleton className="h-10 w-24" />
						</div>
					</div>
				</WebSurfacePanel>
			))}
		</div>
	);
}

/** `/rewardhub/wallet` while the server prefetches the claims page and the "ready to redeem" count. */
export function WalletPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={WALLET_LOADING_LABELS} className="flex flex-col gap-8">
			<RewardHubPageHeaderSkeleton />
			<StatCardsSkeleton count={WALLET_STAT_COUNT} columns={2} />
			<WalletClaimRowsBones />
		</SkeletonRegion>
	);
}
