"use client";

import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { AccessGate } from "@/components/auth/access-gate";
import { RewardClaimFlow } from "@/components/rewardhub/detail/claim-flow";
import { RewardMerchantAvatar } from "@/components/rewardhub/shared/merchant-avatar";
import { WebPageHeader } from "@/components/web-ui/page-header";
import { WebSurfacePanel } from "@/components/web-ui/surface-panel";
import { useAuth } from "@workspace/client/lib/auth";
import type { Envelope, RewardResponse } from "@workspace/shared";
import { getRewardClaimBlockReason, rewardClaimBlockMessage, epochMs, PLATFORM_DISPLAY_REGION } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import Link from "next/link";
import * as React from "react";
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
		return <p className="text-sm text-muted-foreground">Loading reward…</p>;
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
					<Badge variant="outline">{reward.rewardType.replace("_", " ")}</Badge>
					{isSoldOut ? <Badge variant="destructive-light">Sold out</Badge> : null}
					{claimBlockReason === "expired" ? <Badge variant="destructive-light">Expired</Badge> : null}
				</div>
				<p className="mt-4 text-sm text-muted-foreground">
					<span className="font-medium text-foreground">{reward.quantityRemaining}</span> remaining · Expires{" "}
					{formatEpochMs(reward.expiryDate, "date", PLATFORM_DISPLAY_REGION)}
				</p>
			</WebSurfacePanel>

			<WebSurfacePanel accent className="p-5 sm:p-6">
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
	);
}
