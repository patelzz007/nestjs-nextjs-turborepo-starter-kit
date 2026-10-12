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

export interface MerchantRewardCardProps {
	readonly reward: RewardResponse;
	readonly canManageRewards: boolean;
}

/*
 * The card is a voucher: the offer on top, a tear line, the stub with the
 * numbers below. The two notches of the tear line are CUT OUT with a mask
 * (circles of 8px radius at the seam), not painted in the page colour, so the
 * card reads the same on any surface and in both themes. `NOTCH_RIM_CLASS`
 * draws the cut's edge in the card's border colour; the card clips the half of
 * each rim that falls outside it.
 */
const OFFER_HALF_NOTCHES =
	"[mask-composite:intersect] [mask-image:radial-gradient(circle_8px_at_0_100%,transparent_98%,#000_100%),radial-gradient(circle_8px_at_100%_100%,transparent_98%,#000_100%)]";
const STUB_HALF_NOTCHES =
	"[mask-composite:intersect] [mask-image:radial-gradient(circle_8px_at_0_0,transparent_98%,#000_100%),radial-gradient(circle_8px_at_100%_0,transparent_98%,#000_100%)]";

/** The outline of one notch: a 16px ring centred on the card edge at the seam. */
const NOTCH_RIM_CLASS =
	"absolute top-0 size-4 -translate-y-1/2 rounded-full border border-border transition-[border-color] duration-200 group-hover:border-foreground/20 motion-reduce:transition-none dark:group-hover:border-foreground/25";

/** Each half carries its own border, so the notches open the outline instead of covering it. */
const HALF_CLASS =
	"border-border bg-card transition-[border-color] duration-200 group-hover:border-foreground/20 motion-reduce:transition-none dark:group-hover:border-foreground/25";

/** Grid tile for a merchant reward: its cover and offer, then stock, activity, stores and end date. The whole card opens the reward. */
export function MerchantRewardCard({ reward, canManageRewards }: MerchantRewardCardProps): React.JSX.Element {
	const rewardPath = useOrganizationPath(ORG_ROUTES.rewards.edit(reward.id));
	const ended = isRewardEnded(reward.status);
	const stores = describeRewardStores(reward);
	const { locale } = PLATFORM_DISPLAY_REGION;
	const endLabel = formatRewardEnd(reward);

	return (
		<article
			data-slot="reward-card"
			className="group relative flex h-full flex-col overflow-hidden rounded-xl shadow-xs has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background">
			<div className={cn(HALF_CLASS, OFFER_HALF_NOTCHES, "flex flex-1 flex-col rounded-t-xl border border-b-0")}>
				<CoverImage src={reward.coverImageUrl} className={cn("rounded-t-[inherit]", ended ? "opacity-80 grayscale" : null)} />
				<div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-5">
					<div className="flex items-center justify-between gap-3">
						<p className="truncate text-xs text-muted-foreground capitalize">
							{reward.category}
							{reward.rewardKind === "REFERRER" ? <span className="normal-case"> referral reward</span> : null}
						</p>
						<MerchantRewardStatusBadge status={reward.status} className="shrink-0" />
					</div>

					<div className="flex flex-col gap-2">
						<p className={cn("text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums", ended ? "text-muted-foreground" : "text-primary dark:text-foreground")}>
							{formatRewardOffer(reward.rewardType, reward.rewardValue)}
						</p>
						<h3 className="mt-1 line-clamp-2 text-base leading-snug font-semibold text-foreground">
							<Link href={rewardPath} className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']">
								{reward.title}
								<span className="sr-only">{canManageRewards ? ", manage reward" : ", view reward"}</span>
							</Link>
						</h3>
						<p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{reward.description}</p>
					</div>
				</div>
			</div>

			<div aria-hidden="true" className="relative h-0">
				<span className={cn(NOTCH_RIM_CLASS, "-left-2")} />
				<span className={cn(NOTCH_RIM_CLASS, "-right-2")} />
			</div>

			<div className={cn(HALF_CLASS, STUB_HALF_NOTCHES, "flex flex-col gap-3.5 rounded-b-xl border border-t-0 px-5 pb-4")}>
				<div aria-hidden="true" className="-mx-2 border-t-[1.5px] border-dashed border-border" />

				<RewardStockMeter remaining={reward.quantityRemaining} total={reward.quantityTotal} ended={ended} />

				<dl className="flex gap-5 text-xs">
					<div className="flex flex-row-reverse items-baseline justify-end gap-1">
						<dt className="text-muted-foreground">claimed</dt>
						<dd className="text-sm font-semibold text-foreground tabular-nums">{formatCount(reward.claimCount, locale)}</dd>
					</div>
					<div className="flex flex-row-reverse items-baseline justify-end gap-1">
						<dt className="text-muted-foreground">redeemed</dt>
						<dd className="text-sm font-semibold text-foreground tabular-nums">{formatCount(reward.redemptionCount, locale)}</dd>
					</div>
				</dl>

				<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
					<p className="flex min-w-0 items-center gap-1" title={stores.fullLabel}>
						<MapPin className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="truncate">{stores.label}</span>
					</p>
					<p className="shrink-0 tabular-nums">{endLabel}</p>
				</div>
			</div>
		</article>
	);
}
