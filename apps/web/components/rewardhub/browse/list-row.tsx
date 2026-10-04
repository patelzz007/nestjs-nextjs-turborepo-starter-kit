"use client";

import { RewardInventoryBar } from "@/components/rewardhub/detail/inventory-bar";
import { RewardMerchantAvatar } from "@/components/rewardhub/shared/merchant-avatar";
import { PLATFORM_DISPLAY_REGION, type RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { childPath, ROUTE_PREFIXES } from "@/lib/routes";

export interface RewardListRowProps {
	readonly reward: RewardResponse;
	readonly detailPathPrefix?: string;
}

function rewardTypeLabel(rewardType: RewardResponse["rewardType"]): string {
	return rewardType === "DISCOUNT" ? "Discount" : "Free item";
}

function buildMetaLine(reward: RewardResponse, expiryLabel: string): string {
	const parts: string[] = [];
	if (reward.organizationName !== undefined) {
		parts.push(reward.organizationName);
	}
	parts.push(rewardTypeLabel(reward.rewardType));
	parts.push(`Until ${expiryLabel}`);
	return parts.join(" · ");
}

/** Compact list row for browsing many consumer offers. */
export function RewardListRow({ reward, detailPathPrefix = ROUTE_PREFIXES.rewardHubRewards }: RewardListRowProps): React.JSX.Element {
	const expiryLabel = formatEpochMs(reward.expiryDate, "date", PLATFORM_DISPLAY_REGION);
	const percentLeft = reward.quantityTotal > 0 ? Math.round((reward.quantityRemaining / reward.quantityTotal) * 100) : 0;
	const isLowStock = percentLeft > 0 && percentLeft <= 20;
	const isSoldOut = reward.quantityRemaining === 0;
	const metaLine = buildMetaLine(reward, expiryLabel);

	return (
		<article
			className={cn(
				"group flex items-center gap-3.5 rounded-xl border border-border bg-card px-3.5 py-3 shadow-xs transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none sm:gap-4 sm:px-4 sm:py-3.5",
				isSoldOut ? "opacity-80" : "hover:border-primary/30 hover:shadow-sm",
			)}>
			<RewardMerchantAvatar reward={reward} size="md" />

			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2">
					<h2 className="truncate text-[0.9375rem] font-semibold text-foreground sm:text-base">{reward.title}</h2>
					{isLowStock && !isSoldOut ? (
						<Badge className="hidden shrink-0 border-transparent bg-warning-soft px-1.5 py-0 text-[10px] text-warning sm:inline-flex">Low</Badge>
					) : null}
					{isSoldOut ? (
						<Badge variant="destructive" className="shrink-0 px-1.5 py-0 text-[10px]">
							Sold out
						</Badge>
					) : null}
				</div>
				<p className="mt-1 truncate text-xs text-muted-foreground sm:text-[0.8125rem]">{metaLine}</p>
			</div>

			<div className="hidden w-24 shrink-0 md:block lg:w-28">
				<RewardInventoryBar remaining={reward.quantityRemaining} total={reward.quantityTotal} compact />
			</div>

			<p className="hidden shrink-0 text-xs text-muted-foreground tabular-nums xl:block">
				<span className="font-medium text-foreground">{reward.quantityRemaining}</span> left
			</p>

			<Link
				href={childPath(detailPathPrefix, reward.id)}
				className={cn(
					buttonVariants({ variant: isSoldOut ? "outline" : "default", size: "sm" }),
					"h-9 shrink-0 gap-1.5 px-3 sm:px-3.5",
					isSoldOut ? "pointer-events-none opacity-60" : undefined,
				)}
				aria-disabled={isSoldOut}
				aria-label={isSoldOut ? `${reward.title} unavailable` : `View ${reward.title}`}>
				<span className="hidden sm:inline">{isSoldOut ? "Unavailable" : "View"}</span>
				{!isSoldOut ? <ArrowUpRight className="size-3.5 opacity-80" aria-hidden="true" /> : null}
			</Link>
		</article>
	);
}
