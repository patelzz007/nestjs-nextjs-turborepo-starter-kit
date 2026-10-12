"use client";

import { MerchantRewardStatusBadge } from "@/components/merchant-ui/reward-status";
import { useOrganizationPath } from "@/lib/org/use-organization-path";
import { RewardStockMeter } from "@/components/rewards/reward-stock-meter";
import { describeRewardStores, formatRewardEnd, formatRewardOffer, isRewardEnded } from "@/lib/rewards/presentation";
import { ORG_ROUTES } from "@/lib/routes";
import { PLATFORM_DISPLAY_REGION, type RewardResponse } from "@workspace/shared";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatCount } from "@workspace/ui/lib/format/number";
import { MapPin } from "lucide-react";
import Link from "next/link";
import * as React from "react";

/**
 * Columns of the list: on narrow screens the cover thumbnail sits beside the
 * stacked facts; on wide screens cover, offer, reward, status, stock,
 * activity and end date. The column header uses the same template.
 */
export const REWARD_LIST_COLUMNS_CLASS =
	"grid-cols-[4.5rem_minmax(0,1fr)] lg:grid-cols-[5rem_minmax(7.5rem,0.55fr)_minmax(0,1.6fr)_6.5rem_minmax(9rem,0.7fr)_minmax(7rem,0.5fr)_7rem] lg:items-center lg:gap-6";

/** Every fact sits in the second column beside the thumbnail on narrow screens, and in its own column on wide ones. */
const FACT_CELL_CLASS = "col-start-2 lg:col-start-auto";

/** The list thumbnail's shape — squarer than the 16:9 card cover so it stays legible at row height. */
const THUMBNAIL_RATIO = 4 / 3;

export interface MerchantRewardListRowProps {
	readonly reward: RewardResponse;
	readonly canManageRewards: boolean;
}

/** Dense row for scanning many offers — the same facts as the grid card, in columns. The whole row opens the reward. */
export function MerchantRewardListRow({ reward, canManageRewards }: MerchantRewardListRowProps): React.JSX.Element {
	const rewardPath = useOrganizationPath(ORG_ROUTES.rewards.edit(reward.id));
	const ended = isRewardEnded(reward.status);
	const stores = describeRewardStores(reward);
	const { locale } = PLATFORM_DISPLAY_REGION;
	const endLabel = formatRewardEnd(reward);

	return (
		<article
			data-slot="reward-row"
			className={cn(
				"group relative grid gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-xs transition-[border-color] duration-200 hover:border-foreground/20 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background motion-reduce:transition-none lg:px-5 dark:hover:border-foreground/25",
				REWARD_LIST_COLUMNS_CLASS,
			)}>
			<CoverImage
				src={reward.coverImageUrl}
				ratio={THUMBNAIL_RATIO}
				className={cn("row-span-4 self-start rounded-lg border border-border lg:row-span-1 lg:self-center", ended ? "opacity-80 grayscale" : null)}
			/>

			<div className={cn("flex items-center justify-between gap-3 lg:contents", FACT_CELL_CLASS)}>
				<p className={cn("text-lg leading-tight font-semibold tracking-tight tabular-nums lg:order-1", ended ? "text-muted-foreground" : "text-primary dark:text-foreground")}>
					{formatRewardOffer(reward.rewardType, reward.rewardValue)}
				</p>
				<div className="lg:order-3">
					<MerchantRewardStatusBadge status={reward.status} />
				</div>
			</div>

			<div className={cn("flex min-w-0 flex-col gap-1 lg:order-2", FACT_CELL_CLASS)}>
				<h3 className="truncate text-sm font-semibold text-foreground sm:text-base">
					<Link href={rewardPath} className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']">
						{reward.title}
						<span className="sr-only">{canManageRewards ? ", manage reward" : ", view reward"}</span>
					</Link>
				</h3>
				<p className="line-clamp-1 text-sm text-muted-foreground">{reward.description}</p>
				<p className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
					<span className="shrink-0 capitalize">{reward.category}</span>
					<span className="flex min-w-0 items-center gap-1" title={stores.fullLabel}>
						<MapPin className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{stores.label}</span>
					</span>
				</p>
			</div>

			<div className={cn("lg:order-4", FACT_CELL_CLASS)}>
				<RewardStockMeter remaining={reward.quantityRemaining} total={reward.quantityTotal} ended={ended} />
			</div>

			<div className={cn("flex items-center justify-between gap-3 text-xs lg:contents", FACT_CELL_CLASS)}>
				<dl className="flex gap-4 lg:order-5 lg:flex-col lg:gap-0.5">
					<div className="flex flex-row-reverse items-baseline justify-end gap-1">
						<dt className="text-muted-foreground">claimed</dt>
						<dd className="font-semibold text-foreground tabular-nums">{formatCount(reward.claimCount, locale)}</dd>
					</div>
					<div className="flex flex-row-reverse items-baseline justify-end gap-1">
						<dt className="text-muted-foreground">redeemed</dt>
						<dd className="font-semibold text-foreground tabular-nums">{formatCount(reward.redemptionCount, locale)}</dd>
					</div>
				</dl>
				<p className="text-muted-foreground tabular-nums lg:order-6 lg:text-end">{endLabel}</p>
			</div>
		</article>
	);
}
