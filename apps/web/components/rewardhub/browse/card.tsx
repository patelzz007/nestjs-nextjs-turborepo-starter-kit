"use client";

import { RewardInventoryBar } from "@/components/rewardhub/detail/inventory-bar";
import { RewardCategoryVisual } from "@/components/rewardhub/detail/category-visual";
import { RewardMerchantAvatar } from "@/components/rewardhub/shared/merchant-avatar";
import { PLATFORM_DISPLAY_REGION, type RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { rewardTypeLabel } from "@/lib/rewards/reward-type-label";
import { REWARD_CARD_COVER_RATIO } from "@/lib/rewards/reward-cover";
import { childPath, ROUTE_PREFIXES } from "@/lib/routes";

export interface RewardCardProps {
	readonly reward: RewardResponse;
	readonly detailPathPrefix?: string;
	/** Loads the cover eagerly — only for the first card above the fold. */
	readonly priority?: boolean;
}

/** Consumer reward tile — the offer's cover, then merchant context, copy and scarcity. */
export function RewardCard({ reward, detailPathPrefix = ROUTE_PREFIXES.rewardHubRewards, priority = false }: RewardCardProps): React.JSX.Element {
	const expiryLabel = formatEpochMs(reward.expiryDate, "date", PLATFORM_DISPLAY_REGION);
	const percentLeft = reward.quantityTotal > 0 ? Math.round((reward.quantityRemaining / reward.quantityTotal) * 100) : 0;
	const isLowStock = percentLeft > 0 && percentLeft <= 20;
	const isSoldOut = reward.quantityRemaining === 0;

	return (
		<article
			className={cn(
				"group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-[border-color,box-shadow,transform] duration-200 motion-reduce:transition-none",
				isSoldOut ? "opacity-80" : "hover:border-primary/30 hover:shadow-md",
			)}>
			{/* Edge to edge: the card's own radius and overflow round the cover's top corners. */}
			<div className="relative overflow-hidden border-b border-border/80">
				<CoverImage
					src={reward.coverImageUrl}
					ratio={REWARD_CARD_COVER_RATIO}
					priority={priority}
					fallback={<RewardCategoryVisual category={reward.category} className="size-8" />}
					className={cn(
						"transition-transform duration-300 motion-reduce:transition-none",
						isSoldOut ? "grayscale" : "group-hover:scale-[1.03] motion-reduce:group-hover:scale-100",
					)}
				/>
				{isLowStock && !isSoldOut ? <Badge className="absolute top-3 left-3 border-transparent bg-warning-soft text-warning shadow-xs">Almost gone</Badge> : null}
				{isSoldOut ? <Badge className="absolute top-3 left-3 border-transparent bg-card text-foreground shadow-xs">Sold out</Badge> : null}
			</div>

			<div className="flex items-start gap-3 p-4 pb-0">
				<RewardMerchantAvatar reward={reward} size="lg" />
				<div className="min-w-0 flex-1 space-y-1.5">
					{reward.organizationName !== undefined ? <p className="truncate text-sm font-semibold text-foreground">{reward.organizationName}</p> : null}
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary" className="capitalize">
							{reward.category}
						</Badge>
						<Badge variant="outline">{rewardTypeLabel(reward.rewardType)}</Badge>
					</div>
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
					href={childPath(detailPathPrefix, reward.id)}
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
