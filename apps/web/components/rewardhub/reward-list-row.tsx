"use client";

import { RewardCategoryVisual } from "@/components/rewardhub/reward-category-visual";
import { RewardInventoryBar } from "@/components/rewardhub/reward-inventory-bar";
import type { RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface RewardListRowProps {
	readonly reward: RewardResponse;
	readonly detailPathPrefix?: string;
}

function rewardTypeLabel(rewardType: RewardResponse["rewardType"]): string {
	return rewardType === "DISCOUNT" ? "Discount" : "Free item";
}

function buildMetaLine(reward: RewardResponse, expiryLabel: string): string {
	const parts: string[] = [];
	if (reward.merchantName !== undefined) {
		parts.push(reward.merchantName);
	}
	parts.push(rewardTypeLabel(reward.rewardType));
	parts.push(`Until ${expiryLabel}`);
	return parts.join(" · ");
}

/** Compact list row for browsing many consumer offers. */
export function RewardListRow({ reward, detailPathPrefix = "/rewardhub" }: RewardListRowProps): React.JSX.Element {
	const expiryLabel = format(new Date(reward.expiryDate), "d MMM yyyy");
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
			<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary sm:size-11 sm:rounded-xl">
				<RewardCategoryVisual category={reward.category} className="size-4 sm:size-[1.125rem]" />
			</div>

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
				href={`${detailPathPrefix}/${reward.id}`}
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
