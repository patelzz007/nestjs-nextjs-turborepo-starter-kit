"use client";

import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { MerchantRewardCard } from "@/components/rewards/merchant-reward-card";
import { MerchantRewardListRow, REWARD_LIST_COLUMNS_CLASS } from "@/components/rewards/merchant-reward-list-row";
import { groupRewardsByStatus, type RewardStatusGroup } from "@/lib/rewards/presentation";
import { RewardsViewToggle, type RewardsViewToggleLabels } from "@workspace/client/lib/features/ui-preferences/rewards-view-toggle";
import { useRewardsViewMode, useUiPreferencesCommands, type RewardsViewMode } from "@workspace/client/lib/features/ui-preferences/facade";
import { PLATFORM_DISPLAY_REGION, type RewardResponse } from "@workspace/shared";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type { StatusTone } from "@workspace/ui/components/status-badge";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatCount } from "@workspace/ui/lib/format/number";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

const VIEW_TOGGLE_LABELS: RewardsViewToggleLabels = { group: "Rewards layout", grid: "Grid view", list: "List view" };

export interface MerchantRewardsCatalogProps {
	readonly rewards: readonly RewardResponse[];
	readonly isLoading: boolean;
	readonly canManageRewards: boolean;
}

/** List rows drawn while the catalog loads. */
const SKELETON_LIST_ROWS = 4;
/** Grid cards drawn while the catalog loads — two full rows of the widest grid. */
const SKELETON_GRID_CARDS = 6;
/** Reward-title widths, so the placeholder rewards read as different offers. */
const TITLE_WIDTHS: readonly string[] = ["w-3/4", "w-1/2", "w-2/3", "w-3/5"];

/** The grid of reward cards — the skeleton draws the same columns. */
const GRID_CLASS = "grid gap-5 sm:grid-cols-2 xl:grid-cols-3";

/** The dot before a section title reads like the status badges of the rewards in it (and like the sidebar's section dots). */
const SECTION_DOT_CLASS: Readonly<Record<StatusTone, string>> = {
	success: "bg-success",
	warning: "bg-warning",
	danger: "bg-destructive",
	info: "bg-info",
	neutral: "bg-foreground/50",
	muted: "bg-muted-foreground/60",
};

/** What the catalog announces while it loads. */
export const REWARDS_CATALOG_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading rewards…" };

function titleWidth(index: number): string {
	return TITLE_WIDTHS[index % TITLE_WIDTHS.length] ?? "w-2/3";
}

function rewardCountLabel(count: number): string {
	return `${formatCount(count, PLATFORM_DISPLAY_REGION.locale)} reward${count === 1 ? "" : "s"}`;
}

export interface MerchantRewardsCatalogSkeletonProps {
	readonly viewMode: RewardsViewMode;
}

/**
 * The catalog's silhouette in the member's layout: voucher cards (cover,
 * category and status, offer, title, description, tear line, stock, activity,
 * stores and end date) or list rows (cover thumbnail, then the list's columns). Bones only — wrap it in one
 * `SkeletonRegion`.
 */
export function MerchantRewardsCatalogSkeleton({ viewMode }: MerchantRewardsCatalogSkeletonProps): React.JSX.Element {
	if (viewMode === "list") {
		return (
			<div data-slot="rewards-list-skeleton" className="flex flex-col gap-3">
				{placeholderKeys("reward", SKELETON_LIST_ROWS).map((key, index): React.JSX.Element => (
					<div key={key} className={cn("grid gap-3 rounded-xl border border-border bg-card px-4 py-4 shadow-xs lg:px-5", REWARD_LIST_COLUMNS_CLASS)}>
						<Skeleton className="row-span-4 aspect-4/3 w-full self-start rounded-lg lg:row-span-1 lg:self-center" />
						<Skeleton variant="text" className="col-start-2 h-5 w-20 lg:col-start-auto" />
						<div className="col-start-2 flex min-w-0 flex-col gap-2 lg:col-start-auto">
							<Skeleton variant="text" className={cn("h-4", titleWidth(index))} />
							<Skeleton variant="text" className="h-3.5 w-4/5" />
							<Skeleton variant="text" className="h-3 w-32" />
						</div>
						<Skeleton className="hidden h-5 w-14 rounded-full lg:block" />
						<div className="col-start-2 flex flex-col gap-1.5 lg:col-start-auto">
							<Skeleton variant="text" className="h-3 w-20" />
							<Skeleton className="h-1.5 w-full rounded-full" />
						</div>
						<div className="hidden flex-col gap-1.5 lg:flex">
							<Skeleton variant="text" className="h-3 w-16" />
							<Skeleton variant="text" className="h-3 w-20" />
						</div>
						<Skeleton variant="text" className="hidden h-3 w-20 justify-self-end lg:block" />
					</div>
				))}
			</div>
		);
	}

	return (
		<div data-slot="rewards-grid-skeleton" className={GRID_CLASS}>
			{placeholderKeys("reward", SKELETON_GRID_CARDS).map((key, index): React.JSX.Element => (
				<div key={key} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
					<Skeleton className="aspect-video w-full rounded-none" />
					<div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-5">
						<div className="flex items-center justify-between gap-3">
							<Skeleton variant="text" className="h-3 w-16" />
							<Skeleton className="h-5 w-12 rounded-full" />
						</div>
						<div className="flex flex-col gap-2">
							<Skeleton variant="text" className="h-7 w-28" />
							<Skeleton variant="text" className={cn("mt-1 h-4.5", titleWidth(index))} />
							<Skeleton variant="text" className="h-3.5 w-full" />
							<Skeleton variant="text" className="h-3.5 w-2/3" />
						</div>
					</div>
					<div className="flex flex-col gap-3.5 px-5 pb-4">
						<div className="-mx-2 border-t-[1.5px] border-dashed border-border" />
						<div className="flex flex-col gap-1.5">
							<Skeleton variant="text" className="h-3 w-20" />
							<Skeleton className="h-1.5 w-full rounded-full" />
						</div>
						<Skeleton variant="text" className="h-3.5 w-36" />
						<div className="flex items-center justify-between gap-3">
							<Skeleton variant="text" className="h-3 w-24" />
							<Skeleton variant="text" className="h-3 w-20" />
						</div>
					</div>
				</div>
			))}
		</div>
	);
}

interface RewardSectionProps {
	readonly group: RewardStatusGroup;
	readonly children: React.ReactNode;
}

/** One status section: a dotted title with its count, then its rewards. */
function RewardSection({ group, children }: RewardSectionProps): React.JSX.Element {
	const titleId = React.useId();
	return (
		<section aria-labelledby={titleId} data-slot="rewards-section" data-group={group.id} className="flex flex-col gap-3">
			<h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
				<span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", SECTION_DOT_CLASS[group.tone])} />
				{group.title}
				<span className="font-normal text-muted-foreground tabular-nums">{formatCount(group.rewards.length, PLATFORM_DISPLAY_REGION.locale)}</span>
			</h2>
			{children}
		</section>
	);
}

/** Rewards grouped by status (live, in review, drafts, ended), as voucher cards or list rows. */
export function MerchantRewardsCatalog({ rewards, isLoading, canManageRewards }: MerchantRewardsCatalogProps): React.JSX.Element {
	const viewMode = useRewardsViewMode();
	const { changeRewardsViewMode } = useUiPreferencesCommands();
	const groups = React.useMemo(() => groupRewardsByStatus(rewards), [rewards]);

	return (
		<section className="flex flex-col gap-6" aria-label="Rewards catalog">
			<div className="flex items-center justify-between gap-3">
				{isLoading ? (
					<Skeleton variant="text" aria-hidden="true" className="h-4 w-20" />
				) : (
					<p className="text-sm text-muted-foreground tabular-nums">{rewardCountLabel(rewards.length)}</p>
				)}
				<RewardsViewToggle viewMode={viewMode} onViewModeChange={changeRewardsViewMode} labels={VIEW_TOGGLE_LABELS} />
			</div>

			{isLoading ? (
				<SkeletonRegion labels={REWARDS_CATALOG_LOADING_LABELS}>
					<MerchantRewardsCatalogSkeleton viewMode={viewMode} />
				</SkeletonRegion>
			) : viewMode === "grid" ? (
				groups.map((group) => (
					<RewardSection key={group.id} group={group}>
						<div className={GRID_CLASS}>
							{group.rewards.map((reward) => (
								<MerchantRewardCard key={reward.id} reward={reward} canManageRewards={canManageRewards} />
							))}
						</div>
					</RewardSection>
				))
			) : (
				<>
					<div aria-hidden="true" className={cn("hidden px-5 text-xs text-muted-foreground lg:grid", REWARD_LIST_COLUMNS_CLASS)}>
						<span>Cover</span>
						<span>Offer</span>
						<span>Reward</span>
						<span>Status</span>
						<span>Inventory</span>
						<span>Activity</span>
						<span className="text-end">Ends</span>
					</div>
					{groups.map((group) => (
						<RewardSection key={group.id} group={group}>
							<div className="flex flex-col gap-3">
								{group.rewards.map((reward) => (
									<MerchantRewardListRow key={reward.id} reward={reward} canManageRewards={canManageRewards} />
								))}
							</div>
						</RewardSection>
					))}
				</>
			)}
		</section>
	);
}
