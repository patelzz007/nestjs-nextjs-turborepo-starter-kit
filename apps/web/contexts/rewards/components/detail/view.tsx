"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { AccessGate } from "@/contexts/identity";
import { readReferralToken, ReferralAttributionCapture, RewardReferralShare, withReferralToken } from "@/contexts/referrals";
import { RewardDetailSkeleton } from "@/components/loading/reward-detail-skeleton";
import { RewardClaimFlow } from "@/contexts/rewards/components/detail/claim-flow";
import { RewardGallery } from "@/contexts/rewards/components/detail/gallery";
import { RewardHowItWorks } from "@/contexts/rewards/components/detail/how-it-works";
import { RewardInventoryBar } from "@/contexts/rewards/components/detail/inventory-bar";
import { RewardMoreFromMerchant } from "@/contexts/rewards/components/detail/more-from-merchant";
import { RewardOfferFacts } from "@/contexts/rewards/components/detail/offer-facts";
import { RewardMerchantAvatar } from "@/components/dashboard/shared/merchant-avatar";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { formatRewardOffer, rewardTypeLabel } from "@workspace/client/lib/contexts/rewards/reward-offer";
import type { Envelope, RewardResponse } from "@workspace/shared";
import { getRewardClaimBlockReason, rewardClaimBlockMessage, epochMs, PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { formatCount } from "@workspace/ui/lib/format/number";
import { Card } from "@workspace/ui/components/card";
import { Clock, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";
import { ROUTE_PREFIXES, ROUTES } from "@/lib/routes";

export interface RewardDetailViewProps {
	readonly rewardId: string;
	readonly initialReward?: Envelope<RewardResponse> | undefined;
	/** Where "More from this merchant" links — the public page keeps visitors on public pages. */
	readonly detailPathPrefix?: string;
}

const DAY_MS = 86_400_000;
/** An offer ending within this many days is flagged "Ending soon". */
const ENDING_SOON_DAYS = 3;
/** Stock at or below this share of the total is flagged "Almost gone". */
const LOW_STOCK_SHARE = 0.2;
/** How often the page re-reads stock and re-checks the clock. */
const REFRESH_INTERVAL_MS = 60_000;

/** "Ends today", "Ends tomorrow", "3 days left" — or `null` once more than a week remains (the date says enough). */
function describeTimeLeft(expiryMs: number, nowMs: number): string | null {
	const daysLeft = Math.ceil((expiryMs - nowMs) / DAY_MS);
	if (daysLeft <= 0) {
		return null;
	}
	if (daysLeft === 1) {
		return "Ends within a day";
	}
	return daysLeft <= 7 ? `${String(daysLeft)} days left` : null;
}

/**
 * Reward detail (public and signed-in) with the claim flow: the gallery leads,
 * the offer and its claim panel stay beside it on wide screens, then how it
 * works, the fine print, and the merchant's other offers. Claiming needs an
 * account but no permission — guests see a sign-in prompt in place of the flow.
 */
export function RewardDetailView({ rewardId, initialReward, detailPathPrefix = ROUTE_PREFIXES.dashboardRewards }: RewardDetailViewProps): React.JSX.Element {
	const { api } = useAuth();

	const rewardQuery = api.rewards.detail.useQuery({ rewardId }, { ...initialDataOption(initialReward), refetchInterval: REFRESH_INTERVAL_MS });
	const reward = rewardQuery.data?.data;

	const [message, setMessage] = React.useState<string | null>(null);
	const pathname = usePathname();
	// A friend's referral link (`?ref=`): recorded once signed in, and kept through the sign-in prompt.
	const referralToken = readReferralToken(useSearchParams());
	const [nowMs, setNowMs] = React.useState<number>(() => Date.now());

	React.useEffect((): (() => void) => {
		const intervalId = window.setInterval((): void => {
			setNowMs(Date.now());
		}, REFRESH_INTERVAL_MS);
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
				<Link href={ROUTES.dashboard.browse} className={cn(buttonVariants({ variant: "outline" }))}>
					Browse other offers
				</Link>
			</div>
		);
	}

	const isSoldOut = reward.quantityRemaining <= 0;
	const isExpired = claimBlockReason === "expired";
	const isLowStock = !isSoldOut && reward.quantityTotal > 0 && reward.quantityRemaining / reward.quantityTotal <= LOW_STOCK_SHARE;
	const timeLeft = isExpired ? null : describeTimeLeft(reward.expiryDate, nowMs);
	const isEndingSoon = timeLeft !== null && Math.ceil((reward.expiryDate - nowMs) / DAY_MS) <= ENDING_SOON_DAYS;
	const { locale } = PLATFORM_DISPLAY_REGION;
	const offer = formatRewardOffer(reward.rewardType, reward.rewardValue);
	// "Free item" / "Buy one, get one" already read as the offer — the type badge would only repeat it.
	const typeLabel = rewardTypeLabel(reward.rewardType);

	return (
		<div className="@container space-y-12">
			<div className="grid gap-8 @4xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @4xl:items-start">
				{/* Wide: the gallery and the fine print scroll past while the offer and its claim panel stay in view. */}
				<div className="space-y-10">
					<RewardGallery reward={reward} muted={isSoldOut || isExpired} />
					<RewardHowItWorks />
					<RewardOfferFacts reward={reward} />
				</div>

				<div className="space-y-6 @4xl:sticky @4xl:top-24">
					<Card className="gap-0 p-5 sm:p-6">
						{reward.tenantName === undefined ? null : (
							<div className="flex items-center gap-3">
								<RewardMerchantAvatar reward={reward} size="lg" />
								<div className="min-w-0">
									<p className="text-xs text-muted-foreground">Offered by</p>
									<p className="truncate text-sm font-semibold text-foreground">{reward.tenantName}</p>
								</div>
							</div>
						)}
						<div className="mt-5 flex flex-wrap gap-2">
							<Badge variant="secondary" className="capitalize">
								{reward.category}
							</Badge>
							{typeLabel === offer ? null : <Badge variant="outline">{typeLabel}</Badge>}
							{isSoldOut ? <Badge variant="destructive-light">Sold out</Badge> : null}
							{isExpired ? <Badge variant="destructive-light">Expired</Badge> : null}
							{isLowStock ? <Badge className="border-transparent bg-warning-soft text-warning">Almost gone</Badge> : null}
							{isEndingSoon ? <Badge className="border-transparent bg-warning-soft text-warning">Ending soon</Badge> : null}
						</div>
						<h1 className="mt-3 text-2xl leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-3xl">{reward.title}</h1>
						<p className="mt-2 text-xl font-semibold text-primary tabular-nums">{offer}</p>
						<p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{reward.description}</p>

						<div className="mt-5 space-y-4 border-t border-border pt-5">
							<RewardInventoryBar remaining={reward.quantityRemaining} total={reward.quantityTotal} />
							<div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
								<span className="inline-flex items-center gap-1.5">
									<Clock className="size-4 shrink-0" aria-hidden="true" />
									<span>
										{isExpired ? "Ended" : "Ends"} {formatEpochMs(reward.expiryDate, "date", PLATFORM_DISPLAY_REGION)}
										{timeLeft === null ? null : <span className="font-medium text-foreground">{` (${timeLeft})`}</span>}
									</span>
								</span>
								{reward.claimCount > 0 ? (
									<span className="inline-flex items-center gap-1.5">
										<Users className="size-4 shrink-0" aria-hidden="true" />
										<span>
											<span className="font-medium text-foreground tabular-nums">{formatCount(reward.claimCount, locale)}</span> claimed
										</span>
									</span>
								) : null}
							</div>
						</div>
					</Card>

					<Card className="gap-0 p-5 sm:p-6">
						<h2 className="text-base font-semibold">Claim this reward</h2>
						<div className="mt-4 space-y-4">
							{message !== null ? <p className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}

							{!canClaim ? (
								<div className="space-y-3">
									<p className="text-sm text-muted-foreground">{rewardClaimBlockMessage(claimBlockReason)}</p>
									<Link href={ROUTES.dashboard.browse} className={cn(buttonVariants({ variant: "outline" }))}>
										Browse other offers
									</Link>
								</div>
							) : (
								<AccessGate
									feature="this reward"
									signInDescription="Sign in or create a free account to claim this reward."
									returnTo={withReferralToken(pathname, referralToken)}
									className="py-8">
									<RewardClaimFlow rewardId={rewardId} onMessage={setMessage} onClaimFailed={handleClaimFailed} />
								</AccessGate>
							)}
						</div>
						{reward.referralsEnabled && canClaim ? (
							<div className="mt-4 border-t border-border pt-4">
								<RewardReferralShare rewardId={reward.id} rewardTitle={reward.title} />
							</div>
						) : null}
					</Card>
				</div>
			</div>
			<ReferralAttributionCapture attributionToken={referralToken} onMessage={setMessage} />

			<RewardMoreFromMerchant reward={reward} detailPathPrefix={detailPathPrefix} />
		</div>
	);
}
