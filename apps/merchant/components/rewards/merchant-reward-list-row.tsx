"use client";

import { formatRewardTypeLabel, formatRewardValueSummary } from "@/components/rewards/merchant-reward-form.constants";
import { MerchantInventoryBar, MerchantRewardStatusBadge } from "@/components/merchant-ui/reward-status";
import type { RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface MerchantRewardListRowProps {
	readonly reward: RewardResponse;
	readonly canManageRewards: boolean;
}

/** Dense list row for merchant rewards — optimized for scanning many offers. */
export function MerchantRewardListRow({ reward, canManageRewards }: MerchantRewardListRowProps): React.JSX.Element {
	const expiryLabel = format(new Date(reward.expiryDate), "d MMM yyyy");
	const isLive = reward.status === "PUBLISHED";

	return (
		<article
			className={cn(
				"group grid gap-4 rounded-xl border border-border bg-card px-4 py-4 shadow-xs transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none lg:grid-cols-[minmax(0,1.6fr)_auto_minmax(10rem,0.75fr)_minmax(7rem,0.5fr)_auto] lg:items-center lg:gap-6 lg:px-5",
				isLive ? "hover:border-primary/35 hover:shadow-sm" : "hover:border-border/80 hover:shadow-sm",
			)}>
			<div className="min-w-0 space-y-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="truncate text-sm font-semibold text-foreground sm:text-base">{reward.title}</h2>
					<Badge variant="secondary" className="hidden capitalize sm:inline-flex">
						{reward.category}
					</Badge>
					<Badge variant="outline" className="hidden sm:inline-flex">
						{formatRewardTypeLabel(reward.rewardType)}
					</Badge>
				</div>
				<p className="text-sm font-medium text-primary">{formatRewardValueSummary(reward.rewardType, reward.rewardValue)}</p>
				<p className="line-clamp-1 text-sm text-muted-foreground">{reward.description}</p>
				<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground lg:hidden">
					<span className="tabular-nums">
						{reward.claimCount} claims · {reward.redemptionCount} redeemed
					</span>
					<span aria-hidden="true">·</span>
					<span>Expires {expiryLabel}</span>
				</div>
			</div>

			<div className="flex items-center lg:justify-center">
				<MerchantRewardStatusBadge status={reward.status} />
			</div>

			<div className="min-w-0">
				<MerchantInventoryBar remaining={reward.quantityRemaining} total={reward.quantityTotal} />
			</div>

			<div className="hidden text-sm text-muted-foreground tabular-nums lg:block">
				<p>
					<span className="font-medium text-foreground">{reward.claimCount}</span> claims
				</p>
				<p className="mt-0.5">
					<span className="font-medium text-foreground">{reward.redemptionCount}</span> redeemed
				</p>
				<p className="mt-2 text-xs">Expires {expiryLabel}</p>
			</div>

			<div className="flex shrink-0 items-center justify-end">
				<Link href={`/rewards/${reward.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
					{canManageRewards ? "Manage" : "View"}
					<ArrowUpRight className="size-3.5 opacity-70" aria-hidden="true" />
				</Link>
			</div>
		</article>
	);
}
