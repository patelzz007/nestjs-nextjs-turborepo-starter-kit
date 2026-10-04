"use client";

import { MerchantRewardCard } from "@/components/rewards/merchant-reward-card";
import { MerchantRewardListRow } from "@/components/rewards/merchant-reward-list-row";
import { RewardsViewToggle, type RewardsViewToggleLabels } from "@workspace/client/lib/features/ui-preferences/rewards-view-toggle";
import { useRewardsViewMode, useUiPreferencesCommands, type RewardsViewMode } from "@workspace/client/lib/features/ui-preferences/facade";
import type { RewardResponse } from "@workspace/shared";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import * as React from "react";

const VIEW_TOGGLE_LABELS: RewardsViewToggleLabels = { group: "Rewards layout", grid: "Grid view", list: "List view" };

export interface MerchantRewardsCatalogProps {
	readonly rewards: readonly RewardResponse[];
	readonly isLoading: boolean;
	readonly canManageRewards: boolean;
}

function RewardsCatalogSkeleton({ viewMode }: { readonly viewMode: RewardsViewMode }): React.JSX.Element {
	if (viewMode === "list") {
		return (
			<div className="space-y-3">
				{Array.from({ length: 4 }, (_, index) => (
					<Skeleton key={index} className="h-24 w-full rounded-xl" />
				))}
			</div>
		);
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{Array.from({ length: 6 }, (_, index) => (
				<Skeleton key={index} className="h-72 w-full rounded-xl" />
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
					<p className="text-sm font-medium text-foreground">{isLoading ? "Loading catalog…" : `${String(rewards.length)} reward${rewards.length === 1 ? "" : "s"}`}</p>
					<p className="text-xs text-muted-foreground">Switch layout to compare inventory across offers.</p>
				</div>
				<RewardsViewToggle viewMode={viewMode} onViewModeChange={changeRewardsViewMode} labels={VIEW_TOGGLE_LABELS} />
			</div>

			{isLoading ? (
				<RewardsCatalogSkeleton viewMode={viewMode} />
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
