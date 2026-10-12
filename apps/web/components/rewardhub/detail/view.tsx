"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { AccessGate } from "@/components/auth/access-gate";
import { RewardDetailSkeleton } from "@/components/loading/reward-detail-skeleton";
import { RewardClaimFlow } from "@/components/rewardhub/detail/claim-flow";
import { RewardCategoryVisual } from "@/components/rewardhub/detail/category-visual";
import { RewardMerchantAvatar } from "@/components/rewardhub/shared/merchant-avatar";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { WebSurfacePanel } from "@/components/web-ui/surface-panel";
import { useAuth } from "@workspace/client/lib/auth";
import type { Envelope, RewardResponse } from "@workspace/shared";
import { getRewardClaimBlockReason, rewardClaimBlockMessage, epochMs, PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { Clock, Package } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { REWARD_CARD_COVER_RATIO } from "@/lib/rewards/reward-cover";
import { rewardTypeLabel } from "@/lib/rewards/reward-type-label";
import { ROUTES } from "@/lib/routes";

export interface RewardDetailViewProps {
	readonly rewardId: string;
	readonly initialReward?: Envelope<RewardResponse> | undefined;
}

/**
 * Reward detail (public) with the claim flow. Claiming needs an account but
 * no permission — guests see a sign-in prompt in place of the flow.
 */
export function RewardDetailView({ rewardId, initialReward }: RewardDetailViewProps): React.JSX.Element {
	const { api } = useAuth();

	const rewardQuery = api.rewards.detail.useQuery(
		{ rewardId },
		{
			...initialDataOption(initialReward),
			refetchInterval: 60_000,
		},
	);
	const reward = rewardQuery.data?.data;

	const [message, setMessage] = React.useState<string | null>(null);
	const [nowMs, setNowMs] = React.useState<number>(() => Date.now());

	React.useEffect((): (() => void) => {
		const intervalId = window.setInterval((): void => {
			setNowMs(Date.now());
		}, 60_000);
		return (): void => {
			window.clearInterval(intervalId);
		};
	}, []);

	const claimBlockReason = React.useMemo(() => (reward === undefined ? null : getRewardClaimBlockReason(reward, epochMs(nowMs))), [reward, nowMs]);
	const canClaim = claimBlockReason === null;

	const handleClaimFailed = React.useCallback((): void => {
		void rewardQuery.refetch();
	}, [rewardQuery]);

	if (rewardQuery.isLoading && initialReward === undefined) {
		return <RewardDetailSkeleton />;
	}

	if (reward === undefined) {
		return (
			<div className="space-y-6">
				<WebPageHeader title="Reward unavailable" description="This reward may have expired or been removed." />
				<Link href={ROUTES.rewardHub.browse} className={cn(buttonVariants({ variant: "outline" }))}>
					Back to browse
				</Link>
			</div>
		);
	}

	const isSoldOut = reward.quantityRemaining <= 0;

	return (
		<div className="space-y-8">
			<WebPageHeader title={reward.title} description={reward.description} />

			<Link href={ROUTES.rewardHub.browse} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-mt-4")}>
				← Back to browse
			</Link>

			{/*
			 * The cover leads. Where the page is wide enough (a container query, as the public page is narrower
			 * than the signed-in one), the offer and its claim panel sit beside it, like a product page.
			 */}
			<div className="@container">
				<div className="grid gap-6 @4xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @4xl:items-start">
					<CoverImage
						src={reward.coverImageUrl}
						ratio={REWARD_CARD_COVER_RATIO}
						priority
						fallback={<RewardCategoryVisual category={reward.category} className="size-12" />}
						className={cn("rounded-2xl border border-border shadow-xs", isSoldOut ? "grayscale" : undefined)}
					/>
					<div className="space-y-6">
						<WebSurfacePanel className="p-5 sm:p-6">
							{reward.organizationName !== undefined ? (
								<div className="mb-4 flex items-center gap-3">
									<RewardMerchantAvatar reward={reward} size="xl" />
									<div className="min-w-0">
										<p className="text-xs text-muted-foreground">Offered by</p>
										<p className="truncate text-base font-semibold text-foreground">{reward.organizationName}</p>
									</div>
								</div>
							) : null}
							<div className="flex flex-wrap gap-2">
								<Badge variant="secondary" className="capitalize">
									{reward.category}
								</Badge>
								<Badge variant="outline">{rewardTypeLabel(reward.rewardType)}</Badge>
								{isSoldOut ? <Badge variant="destructive-light">Sold out</Badge> : null}
								{claimBlockReason === "expired" ? <Badge variant="destructive-light">Expired</Badge> : null}
							</div>
							<div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
								<span className="inline-flex items-center gap-1.5">
									<Package className="size-4 shrink-0" aria-hidden="true" />
									<span>
										<span className="font-medium text-foreground tabular-nums">{reward.quantityRemaining}</span> remaining
									</span>
								</span>
								<span className="inline-flex items-center gap-1.5">
									<Clock className="size-4 shrink-0" aria-hidden="true" />
									Expires {formatEpochMs(reward.expiryDate, "date", PLATFORM_DISPLAY_REGION)}
								</span>
							</div>
						</WebSurfacePanel>

						<WebSurfacePanel className="p-5 sm:p-6">
							<h2 className="text-base font-semibold">Claim this reward</h2>
							<div className="mt-4 space-y-4">
								{message !== null ? <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}

								{!canClaim ? (
									<div className="space-y-3">
										<p className="text-sm text-muted-foreground">{rewardClaimBlockMessage(claimBlockReason)}</p>
										<Link href={ROUTES.rewardHub.browse} className={cn(buttonVariants({ variant: "outline" }))}>
											Browse other offers
										</Link>
									</div>
								) : (
									<AccessGate feature="this reward" signInDescription="Sign in or create a free account to claim this reward." className="py-8">
										<RewardClaimFlow rewardId={rewardId} onMessage={setMessage} onClaimFailed={handleClaimFailed} />
									</AccessGate>
								)}
							</div>
						</WebSurfacePanel>
					</div>
				</div>
			</div>
		</div>
	);
}
