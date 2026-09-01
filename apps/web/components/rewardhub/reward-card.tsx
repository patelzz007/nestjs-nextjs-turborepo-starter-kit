"use client";

import { RewardCategoryVisual } from "@/components/rewardhub/reward-category-visual";
import { RewardInventoryBar } from "@/components/rewardhub/reward-inventory-bar";
import type { RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import { ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface RewardCardProps {
	readonly reward: RewardResponse;
	readonly detailPathPrefix?: string;
}

function rewardTypeLabel(rewardType: RewardResponse["rewardType"]): string {
	return rewardType === "DISCOUNT" ? "Discount" : "Free item";
}

/** Consumer reward tile — scannable offer with merchant context and scarcity. */
export function RewardCard({ reward, detailPathPrefix = "/rewardhub" }: RewardCardProps): React.JSX.Element {
	const expiryLabel = format(new Date(reward.expiryDate), "d MMM yyyy");
	const percentLeft = reward.quantityTotal > 0 ? Math.round((reward.quantityRemaining / reward.quantityTotal) * 100) : 0;
	const isLowStock = percentLeft > 0 && percentLeft <= 20;
	const isSoldOut = reward.quantityRemaining === 0;

	return (
		<article
			className={cn(
				"group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none",
				isSoldOut ? "opacity-80" : "hover:border-primary/30 hover:shadow-md",
			)}>
			<div className="flex items-start gap-3 border-b border-border/80 p-4">
				<div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-primary">
					<RewardCategoryVisual category={reward.category} className="size-5" />
				</div>
				<div className="min-w-0 flex-1 space-y-1.5">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary" className="capitalize">
							{reward.category}
						</Badge>
						<Badge variant="outline">{rewardTypeLabel(reward.rewardType)}</Badge>
						{isLowStock && !isSoldOut ? <Badge className="border-transparent bg-warning-soft text-warning">Almost gone</Badge> : null}
						{isSoldOut ? <Badge variant="destructive">Sold out</Badge> : null}
					</div>
					{reward.merchantName !== undefined ? <p className="truncate text-xs font-medium text-muted-foreground">{reward.merchantName}</p> : null}
				</div>
			</div>

			<div className="flex flex-1 flex-col gap-4 p-4 pt-3">
				<div className="space-y-2">
					<h2 className="text-lg leading-snug font-semibold tracking-tight text-foreground">{reward.title}</h2>
					<p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{reward.description}</p>
				</div>

				<div className="mt-auto space-y-3">
					<RewardInventoryBar remaining={reward.quantityRemaining} total={reward.quantityTotal} />
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Clock className="size-3.5 shrink-0" aria-hidden="true" />
						<span>Valid until {expiryLabel}</span>
					</div>
				</div>
			</div>

			<div className="border-t border-border/80 p-3">
				<Link
					href={`${detailPathPrefix}/${reward.id}`}
					className={cn(
						buttonVariants({ variant: isSoldOut ? "outline" : "default" }),
						"w-full justify-center gap-2",
						isSoldOut ? "pointer-events-none opacity-60" : undefined,
					)}
					aria-disabled={isSoldOut}>
					{isSoldOut ? "Unavailable" : "View offer"}
					{!isSoldOut ? (
						<ArrowUpRight
							className="size-3.5 opacity-80 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
							aria-hidden="true"
						/>
					) : null}
				</Link>
			</div>
		</article>
	);
}
