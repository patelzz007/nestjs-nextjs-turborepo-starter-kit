"use client";

import { RewardVoucher, type RewardVoucherCover } from "@/contexts/rewards/components/reward-voucher";
import { Card } from "@workspace/ui/components/card";
import type { RewardStores } from "@/contexts/rewards/lib/presentation";
import { describeRewardDraftGaps, formatDraftRewardEnd } from "@/contexts/rewards/lib/reward-draft";
import { formatRewardOffer } from "@workspace/client/lib/contexts/rewards/reward-offer";
import type { MerchantRewardFormValues, RewardStatus } from "@workspace/shared";
import { CircleCheck } from "lucide-react";
import * as React from "react";
import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";

/** The preview is about a quarter of the page wide on large screens and the full width below. */
const PREVIEW_COVER_SIZES = "(min-width: 1024px) 24rem, 100vw";

/** A number field the merchant has cleared reads as zero in the preview (the form itself reports it as missing). */
function countOrZero(value: number | undefined): number {
	return value === undefined || Number.isNaN(value) ? 0 : value;
}

export interface MerchantRewardPreviewActivity {
	readonly claimCount: number;
	readonly redemptionCount: number;
}

export interface MerchantRewardPreviewProps {
	readonly control: Control<MerchantRewardFormValues>;
	/** The line above the offer — the reward's category. */
	readonly category: string;
	/** The saved reward's status, or none for a reward not created yet. */
	readonly status: RewardStatus | undefined;
	/** The current cover photo — the first ready photo — or none yet. */
	readonly cover: RewardVoucherCover | undefined;
	/** Where it can be redeemed, as the catalog will say it. */
	readonly stores: RewardStores;
	/** Claims and redemptions so far (none for a new reward). */
	readonly activity: MerchantRewardPreviewActivity;
	/** The editor's save buttons, kept beside the preview so they stay in view. */
	readonly actions: React.ReactNode;
}

/**
 * The editor's side column: the reward's voucher exactly as the catalog will
 * draw it, redrawn as the merchant types; a checklist of what the shared
 * schema still wants, each item a link to the section that fixes it; then the
 * save buttons. Sticky on wide screens, after the form on narrow ones.
 */
export function MerchantRewardPreview({ control, category, status, cover, stores, activity, actions }: MerchantRewardPreviewProps): React.JSX.Element {
	const values = useWatch({ control });
	const gaps = React.useMemo(() => describeRewardDraftGaps(values), [values]);
	const quantityTotal = countOrZero(values.quantityTotal);
	const title = values.title?.trim() ?? "";
	const description = values.description?.trim() ?? "";

	return (
		<aside aria-labelledby="reward-preview-heading" data-slot="reward-preview" className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
			<h2 id="reward-preview-heading" className="text-sm font-medium text-muted-foreground">
				How customers see it
			</h2>
			<RewardVoucher
				cover={cover}
				coverSizes={PREVIEW_COVER_SIZES}
				category={category}
				status={status}
				offer={values.rewardType === undefined ? "" : formatRewardOffer(values.rewardType, countOrZero(values.rewardValue))}
				title={title.length > 0 ? title : <span className="text-muted-foreground">Your reward title</span>}
				description={description.length > 0 ? description : "What customers get will show here."}
				remaining={quantityTotal}
				total={quantityTotal}
				claimCount={activity.claimCount}
				redemptionCount={activity.redemptionCount}
				stores={stores}
				endLabel={formatDraftRewardEnd(values.expiryDate)}
				ended={false}
			/>

			<Card className="gap-0 px-4 py-3.5">
				{gaps.length === 0 ? (
					<p data-slot="reward-ready" className="flex items-center gap-2 text-sm font-medium text-foreground">
						<CircleCheck className="size-4 text-success" aria-hidden="true" />
						Ready to save
					</p>
				) : (
					<div className="flex flex-col gap-2">
						<p id="reward-gaps-heading" className="text-sm font-medium text-foreground">
							Still needed
						</p>
						<ul aria-labelledby="reward-gaps-heading" className="flex flex-col gap-1.5 text-sm">
							{gaps.map((gap): React.JSX.Element => (
								<li key={gap.field} className="flex items-baseline gap-2">
									<span aria-hidden="true" className="size-1.5 shrink-0 translate-y-[-0.1rem] rounded-full bg-muted-foreground/60" />
									<a
										href={`#${gap.sectionId}`}
										className="rounded-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
										{gap.label}
									</a>
								</li>
							))}
						</ul>
					</div>
				)}
			</Card>

			<div className="flex flex-col gap-2">{actions}</div>
		</aside>
	);
}
