import { MerchantRewardStatusBadge } from "@/components/merchant-ui/reward-status";
import { RewardStockMeter } from "@/components/rewards/reward-stock-meter";
import type { RewardStores } from "@/lib/rewards/presentation";
import { PLATFORM_DISPLAY_REGION, type RewardStatus } from "@workspace/shared";
import { CoverImage, type CoverImageSource } from "@workspace/ui/components/cover-image";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatCount } from "@workspace/ui/lib/format/number";
import { MapPin } from "lucide-react";
import * as React from "react";

/*
 * The voucher: the offer on top, a tear line, the stub with the numbers below.
 * The two notches of the tear line are CUT OUT with a mask (circles of 8px
 * radius at the seam), not painted in the page colour, so the voucher reads
 * the same on any surface and in both themes. `NOTCH_RIM_CLASS` draws the
 * cut's edge in the border colour; the voucher clips the half of each rim that
 * falls outside it.
 */
const OFFER_HALF_NOTCHES =
	"[mask-composite:intersect] [mask-image:radial-gradient(circle_8px_at_0_100%,transparent_98%,#000_100%),radial-gradient(circle_8px_at_100%_100%,transparent_98%,#000_100%)]";
const STUB_HALF_NOTCHES =
	"[mask-composite:intersect] [mask-image:radial-gradient(circle_8px_at_0_0,transparent_98%,#000_100%),radial-gradient(circle_8px_at_100%_0,transparent_98%,#000_100%)]";

/** The outline of one notch: a 16px ring centred on the voucher edge at the seam. */
const NOTCH_RIM_CLASS =
	"absolute top-0 size-4 -translate-y-1/2 rounded-full border border-border transition-[border-color] duration-200 group-hover:border-foreground/20 motion-reduce:transition-none dark:group-hover:border-foreground/25";

/** Each half carries its own border, so the notches open the outline instead of covering it. */
const HALF_CLASS =
	"border-border bg-card transition-[border-color] duration-200 group-hover:border-foreground/20 motion-reduce:transition-none dark:group-hover:border-foreground/25";

/** A voucher's cover photo: its default URL and the renditions for `srcset`. */
export interface RewardVoucherCover {
	readonly url: string;
	readonly sources: readonly CoverImageSource[];
}

export interface RewardVoucherProps {
	/** The cover photo, or none yet (a placeholder is drawn in its place). */
	readonly cover: RewardVoucherCover | undefined;
	/** `sizes` of the cover's renditions: how wide this voucher is drawn. */
	readonly coverSizes: string;
	/** The small line above the offer ("cafe", "food referral reward"). */
	readonly category: React.ReactNode;
	/** The status badge's status, or none (a reward that does not exist yet). */
	readonly status: RewardStatus | undefined;
	/** The headline offer ("20% off", "Free item"). */
	readonly offer: string;
	/** The reward's title — plain text, or a link that opens the reward. */
	readonly title: React.ReactNode;
	readonly description: React.ReactNode;
	readonly remaining: number;
	readonly total: number;
	readonly claimCount: number;
	readonly redemptionCount: number;
	readonly stores: RewardStores;
	/** "Ends 14 Nov 2026". */
	readonly endLabel: string;
	/** An ended offer is drawn quieter (greyed cover, muted offer). */
	readonly ended: boolean;
	readonly className?: string;
}

/**
 * How a reward looks to the people who claim it — the same voucher in the
 * catalog grid and in the editor's live preview. Data-agnostic: the caller
 * turns a saved reward, or a form still being filled, into these facts.
 */
export function RewardVoucher({
	cover,
	coverSizes,
	category,
	status,
	offer,
	title,
	description,
	remaining,
	total,
	claimCount,
	redemptionCount,
	stores,
	endLabel,
	ended,
	className,
}: RewardVoucherProps): React.JSX.Element {
	const { locale } = PLATFORM_DISPLAY_REGION;

	return (
		<article
			data-slot="reward-voucher"
			className={cn(
				"group relative flex h-full flex-col overflow-hidden rounded-xl shadow-xs has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background",
				className,
			)}>
			<div className={cn(HALF_CLASS, OFFER_HALF_NOTCHES, "flex flex-1 flex-col rounded-t-xl border border-b-0")}>
				<CoverImage src={cover?.url} sources={cover?.sources} sizes={coverSizes} className={cn("rounded-t-[inherit]", ended ? "opacity-80 grayscale" : null)} />
				<div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-5">
					<div className="flex min-h-5 items-center justify-between gap-3">
						<p className="truncate text-xs text-muted-foreground capitalize">{category}</p>
						{status === undefined ? null : <MerchantRewardStatusBadge status={status} className="shrink-0" />}
					</div>

					<div className="flex flex-col gap-2">
						<p className={cn("text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums", ended ? "text-muted-foreground" : "text-primary dark:text-foreground")}>
							{offer}
						</p>
						<h3 className="mt-1 line-clamp-2 text-base leading-snug font-semibold text-foreground">{title}</h3>
						<p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
					</div>
				</div>
			</div>

			<div aria-hidden="true" className="relative h-0">
				<span className={cn(NOTCH_RIM_CLASS, "-left-2")} />
				<span className={cn(NOTCH_RIM_CLASS, "-right-2")} />
			</div>

			<div className={cn(HALF_CLASS, STUB_HALF_NOTCHES, "flex flex-col gap-3.5 rounded-b-xl border border-t-0 px-5 pb-4")}>
				<div aria-hidden="true" className="-mx-2 border-t-[1.5px] border-dashed border-border" />

				<RewardStockMeter remaining={remaining} total={total} ended={ended} />

				<dl className="flex gap-5 text-xs">
					<div className="flex flex-row-reverse items-baseline justify-end gap-1">
						<dt className="text-muted-foreground">claimed</dt>
						<dd className="text-sm font-semibold text-foreground tabular-nums">{formatCount(claimCount, locale)}</dd>
					</div>
					<div className="flex flex-row-reverse items-baseline justify-end gap-1">
						<dt className="text-muted-foreground">redeemed</dt>
						<dd className="text-sm font-semibold text-foreground tabular-nums">{formatCount(redemptionCount, locale)}</dd>
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
