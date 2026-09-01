"use client";

import { formatRewardTypeLabel, formatRewardValueSummary } from "@/components/rewards/merchant-reward-form.constants";
import { MerchantInventoryBar, MerchantRewardStatusBadge } from "@/components/merchant-ui/reward-status";
import type { RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import { ArrowUpRight, Ticket } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface MerchantRewardCardProps {
	readonly reward: RewardResponse;
}

/** Grid tile for a merchant reward — scannable KPIs and inventory at a glance. */
export function MerchantRewardCard({ reward }: MerchantRewardCardProps): React.JSX.Element {
	const expiryLabel = format(new Date(reward.expiryDate), "d MMM yyyy");
	const isLive = reward.status === "PUBLISHED";

	return (
		<article
			className={cn(
				"group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none",
				isLive ? "hover:border-primary/35 hover:shadow-sm" : "hover:border-border/80 hover:shadow-sm",
			)}>
			<div className="flex items-start justify-between gap-3 border-b border-border/80 px-4 py-3">
				<div className="flex min-w-0 flex-wrap items-center gap-2">
					<Badge variant="secondary" className="capitalize">
						{reward.category}
					</Badge>
					<span className="text-xs text-muted-foreground capitalize">{reward.rewardKind.replaceAll("_", " ").toLowerCase()}</span>
				</div>
				<MerchantRewardStatusBadge status={reward.status} />
			</div>

			<div className="flex flex-1 flex-col gap-4 p-4">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline" className="font-medium">
							{formatRewardTypeLabel(reward.rewardType)}
						</Badge>
						<span className="text-sm font-medium text-primary">{formatRewardValueSummary(reward.rewardType, reward.rewardValue)}</span>
					</div>
					<h2 className="text-base leading-snug font-semibold tracking-tight text-foreground">{reward.title}</h2>
					<p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{reward.description}</p>
				</div>

				<div className="mt-auto space-y-3">
					<MerchantInventoryBar remaining={reward.quantityRemaining} total={reward.quantityTotal} />
					<dl className="grid grid-cols-2 gap-2 text-xs">
						<div className="rounded-lg border border-border/80 bg-muted/40 px-2.5 py-2">
							<dt className="text-muted-foreground">Claims</dt>
							<dd className="mt-0.5 font-semibold text-foreground tabular-nums">{reward.claimCount}</dd>
						</div>
						<div className="rounded-lg border border-border/80 bg-muted/40 px-2.5 py-2">
							<dt className="text-muted-foreground">Redeemed</dt>
							<dd className="mt-0.5 font-semibold text-foreground tabular-nums">{reward.redemptionCount}</dd>
						</div>
					</dl>
					<p className="text-xs text-muted-foreground">Expires {expiryLabel}</p>
				</div>
			</div>

			<div className="border-t border-border/80 p-3">
				<Link href={`/rewards/${reward.id}`} className={cn(buttonVariants({ size: "sm", variant: isLive ? "default" : "outline" }), "w-full justify-center gap-2")}>
					<Ticket className="size-4" aria-hidden="true" />
					Manage reward
					<ArrowUpRight
						className="size-3.5 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
						aria-hidden="true"
					/>
				</Link>
			</div>
		</article>
	);
}
