"use client";

import { RewardInventoryBar } from "@/contexts/rewards/components/detail/inventory-bar";
import { RewardCategoryVisual } from "@/contexts/rewards/components/detail/category-visual";
import { RewardMerchantAvatar } from "@/components/dashboard/shared/merchant-avatar";
import { PLATFORM_DISPLAY_REGION, type RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { buttonVariants } from "@workspace/ui/components/button";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { Clock } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { rewardTypeLabel } from "@workspace/client/lib/contexts/rewards/reward-offer";
import { REWARD_LIST_ROW_COVER_RATIO, REWARD_THUMBNAIL_SIZES } from "@/contexts/rewards/lib/reward-cover";
import { childPath, ROUTE_PREFIXES } from "@/lib/routes";

export interface RewardListRowProps {
	readonly reward: RewardResponse;
	readonly detailPathPrefix?: string;
}

/** Compact list row for browsing many consumer offers: cover thumbnail with the merchant's mark, then copy and stock. */
export function RewardListRow({ reward, detailPathPrefix = ROUTE_PREFIXES.dashboardRewards }: RewardListRowProps): React.JSX.Element {
	const expiryLabel = formatEpochMs(reward.expiryDate, "date", PLATFORM_DISPLAY_REGION);
	const percentLeft = reward.quantityTotal > 0 ? Math.round((reward.quantityRemaining / reward.quantityTotal) * 100) : 0;
	const isLowStock = percentLeft > 0 && percentLeft <= 20;
	const isSoldOut = reward.quantityRemaining === 0;
	const [cover] = reward.images;

	return (
		<article
			className={cn(
				"group flex items-center gap-3.5 rounded-xl border border-border bg-card py-2.5 pr-3.5 pl-2.5 shadow-xs transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none sm:gap-4 sm:py-3 sm:pr-4 sm:pl-3",
				isSoldOut ? "opacity-80" : "hover:border-primary/30 hover:shadow-sm",
			)}>
			{/* The merchant's mark sits on the thumbnail's corner: the cover shows the offer, the mark who offers it. */}
			<div className="relative shrink-0">
				<CoverImage
					src={cover?.url}
					sources={cover?.sources}
					sizes={REWARD_THUMBNAIL_SIZES}
					ratio={REWARD_LIST_ROW_COVER_RATIO}
					fallback={<RewardCategoryVisual category={reward.category} className="size-5" />}
					className={cn("w-20 rounded-lg sm:w-24", isSoldOut ? "grayscale" : undefined)}
				/>
				<RewardMerchantAvatar reward={reward} size="sm" className="absolute -right-1.5 -bottom-1.5 ring-2 ring-card" />
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-2">
					<h2 className="line-clamp-2 text-[0.9375rem] leading-snug font-semibold text-foreground sm:line-clamp-1 sm:text-base">{reward.title}</h2>
					{isLowStock && !isSoldOut ? (
						<Badge className="hidden shrink-0 border-transparent bg-warning-soft px-1.5 py-0 text-[10px] text-warning sm:inline-flex">Low</Badge>
					) : null}
					{isSoldOut ? (
						<Badge variant="destructive-light" className="shrink-0 px-1.5 py-0 text-[10px]">
							Sold out
						</Badge>
					) : null}
				</div>
				{reward.organizationName !== undefined ? (
					<p className="mt-0.5 truncate text-xs font-medium text-muted-foreground sm:text-[0.8125rem]">{reward.organizationName}</p>
				) : null}
				<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
					<span>{rewardTypeLabel(reward.rewardType)}</span>
					<span className="inline-flex items-center gap-1">
						<Clock className="size-3 shrink-0" aria-hidden="true" />
						Until {expiryLabel}
					</span>
				</div>
			</div>

			<div className="hidden w-24 shrink-0 md:block lg:w-28">
				<RewardInventoryBar remaining={reward.quantityRemaining} total={reward.quantityTotal} compact />
			</div>

			<Link
				href={childPath(detailPathPrefix, reward.id)}
				className={cn(
					buttonVariants({ variant: isSoldOut ? "outline" : "default", size: "sm" }),
					"h-9 shrink-0 px-3 sm:px-3.5",
					isSoldOut ? "pointer-events-none opacity-60" : undefined,
				)}
				aria-disabled={isSoldOut}
				aria-label={isSoldOut ? `${reward.title} unavailable` : `View ${reward.title}`}>
				{isSoldOut ? "Unavailable" : "View"}
			</Link>
		</article>
	);
}
