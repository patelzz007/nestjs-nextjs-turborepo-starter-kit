"use client";

import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { MerchantRewardCard } from "@/components/rewards/merchant-reward-card";
import { MerchantRewardListRow } from "@/components/rewards/merchant-reward-list-row";
import { RewardsViewToggle, type RewardsViewToggleLabels } from "@workspace/client/lib/features/ui-preferences/rewards-view-toggle";
import { useRewardsViewMode, useUiPreferencesCommands, type RewardsViewMode } from "@workspace/client/lib/features/ui-preferences/facade";
import type { RewardResponse } from "@workspace/shared";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
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

/** What the catalog announces while it loads. */
export const REWARDS_CATALOG_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading rewards…" };

function titleWidth(index: number): string {
	return TITLE_WIDTHS[index % TITLE_WIDTHS.length] ?? "w-2/3";
}

export interface MerchantRewardsCatalogSkeletonProps {
	readonly viewMode: RewardsViewMode;
}

/**
 * The catalog's silhouette in the member's layout: reward cards (kind header,
 * type and value, title, description, claim/redeem tiles, action) or list rows
 * (title and badges, value, description, status, inventory, activity, action).
 * Bones only — wrap it in one `SkeletonRegion`.
 */
export function MerchantRewardsCatalogSkeleton({ viewMode }: MerchantRewardsCatalogSkeletonProps): React.JSX.Element {
	if (viewMode === "list") {
		return (
			<div data-slot="rewards-list-skeleton" className="flex flex-col gap-3">
				{placeholderKeys("reward", SKELETON_LIST_ROWS).map((key, index): React.JSX.Element => (
					<div
						key={key}
						className="grid gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-xs lg:grid-cols-[minmax(0,1.6fr)_auto_minmax(10rem,0.75fr)_minmax(7rem,0.5fr)_auto] lg:items-center lg:gap-6">
						<div className="flex min-w-0 flex-col gap-2">
							<Skeleton variant="text" className={cn("h-4", titleWidth(index))} />
							<Skeleton variant="text" className="h-3.5 w-28" />
							<Skeleton variant="text" className="h-3.5 w-4/5" />
						</div>
						<Skeleton className="h-5 w-16 rounded-full" />
						<Skeleton className="hidden h-2 w-full rounded-full lg:block" />
						<div className="hidden flex-col gap-1.5 lg:flex">
							<Skeleton variant="text" className="h-3.5 w-20" />
							<Skeleton variant="text" className="h-3.5 w-24" />
						</div>
						<Skeleton className="h-8 w-20 justify-self-end" />
					</div>
				))}
			</div>
		);
	}

	return (
		<div data-slot="rewards-grid-skeleton" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{placeholderKeys("reward", SKELETON_GRID_CARDS).map((key, index): React.JSX.Element => (
				<div key={key} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
					<div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
						<div className="flex items-center gap-2">
							<Skeleton className="h-5 w-16 rounded-full" />
							<Skeleton variant="text" className="h-3 w-20" />
						</div>
						<Skeleton className="h-5 w-16 rounded-full" />
					</div>
					<div className="flex flex-1 flex-col gap-4 p-4">
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<Skeleton className="h-5 w-20 rounded-full" />
								<Skeleton variant="text" className="h-3.5 w-16" />
							</div>
							<Skeleton variant="text" className={cn("h-4.5", titleWidth(index))} />
							<Skeleton variant="text" className="h-3.5 w-full" />
							<Skeleton variant="text" className="h-3.5 w-2/3" />
						</div>
						<div className="grid grid-cols-2 gap-2">
							<Skeleton className="h-12 rounded-lg" />
							<Skeleton className="h-12 rounded-lg" />
						</div>
						<Skeleton variant="text" className="h-3 w-32" />
					</div>
					<div className="border-t border-border/80 p-3">
						<Skeleton className="h-8 w-full" />
					</div>
				</div>
			))}
		</div>
	);
}

/** Rewards collection with grid/list layout toggle and toolbar. */
export function MerchantRewardsCatalog({ rewards, isLoading, canManageRewards }: MerchantRewardsCatalogProps): React.JSX.Element {
	const viewMode = useRewardsViewMode();
	const { changeRewardsViewMode } = useUiPreferencesCommands();

	return (
		<section className="space-y-4" aria-label="Rewards catalog">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
				<div>
					{isLoading ? (
						<Skeleton variant="text" aria-hidden="true" className="my-0.5 h-4 w-20" />
					) : (
						<p className="text-sm font-medium text-foreground">{`${String(rewards.length)} reward${rewards.length === 1 ? "" : "s"}`}</p>
					)}
					<p className="text-xs text-muted-foreground">Switch layout to compare inventory across offers.</p>
				</div>
				<RewardsViewToggle viewMode={viewMode} onViewModeChange={changeRewardsViewMode} labels={VIEW_TOGGLE_LABELS} />
			</div>

			{isLoading ? (
				<SkeletonRegion labels={REWARDS_CATALOG_LOADING_LABELS}>
					<MerchantRewardsCatalogSkeleton viewMode={viewMode} />
				</SkeletonRegion>
			) : viewMode === "grid" ? (
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{rewards.map((reward) => (
						<MerchantRewardCard key={reward.id} reward={reward} canManageRewards={canManageRewards} />
					))}
				</div>
			) : (
				<div className="space-y-3">
					<div className="hidden px-5 text-xs font-medium tracking-wide text-muted-foreground uppercase lg:grid lg:grid-cols-[minmax(0,1.6fr)_auto_minmax(10rem,0.75fr)_minmax(7rem,0.5fr)_auto] lg:gap-6">
						<span>Reward</span>
						<span className="text-center">Status</span>
						<span>Inventory</span>
						<span>Activity</span>
						<span className="text-end">Action</span>
					</div>
					{rewards.map((reward) => (
						<MerchantRewardListRow key={reward.id} reward={reward} canManageRewards={canManageRewards} />
					))}
				</div>
			)}
		</section>
	);
}
