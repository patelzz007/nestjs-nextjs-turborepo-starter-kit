"use client";

import { RewardCard } from "@/contexts/rewards/components/browse/card";
import { RewardListRow } from "@/contexts/rewards/components/browse/list-row";
import { REWARDS_CATALOG_LOADING_LABELS } from "@/components/loading/loading-labels";
import { RewardCatalogBones } from "@/components/loading/reward-catalog-skeleton";
import { RewardsViewToggle, type RewardsViewToggleLabels } from "@workspace/client/lib/features/ui-preferences/rewards-view-toggle";
import { useRewardsViewMode, useUiPreferencesCommands } from "@workspace/client/lib/features/ui-preferences/facade";
import type { RewardResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { ROUTE_PREFIXES } from "@/lib/routes";

const VIEW_TOGGLE_LABELS: RewardsViewToggleLabels = { group: "Rewards layout", grid: "Grid view", list: "List view" };

export interface DashboardCatalogProps {
	readonly rewards: readonly RewardResponse[];
	readonly isLoading: boolean;
	readonly hasNext: boolean;
	readonly hasPrevious: boolean;
	readonly onNext: () => void;
	readonly onPrevious: () => void;
	readonly detailPathPrefix?: string;
}

/** Consumer rewards collection with grid/list toggle and cursor pagination. */
export function DashboardCatalog({
	rewards,
	isLoading,
	hasNext,
	hasPrevious,
	onNext,
	onPrevious,
	detailPathPrefix = ROUTE_PREFIXES.dashboardRewards,
}: DashboardCatalogProps): React.JSX.Element {
	const viewMode = useRewardsViewMode();
	const { changeRewardsViewMode } = useUiPreferencesCommands();

	return (
		<section className="space-y-4" aria-label="Rewards catalog">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/25 px-4 py-3">
				<div className="min-w-0">
					{/* While loading, the count is a bone; the catalog's skeleton region below announces the load. */}
					{isLoading ? (
						<Skeleton aria-hidden="true" variant="text" className="my-0.5 h-4 w-32" />
					) : (
						<p className="text-sm font-medium text-foreground">{`Showing ${String(rewards.length)} offers`}</p>
					)}
					<p className="text-xs text-muted-foreground">Switch layout to compare offers at a glance.</p>
				</div>
				<RewardsViewToggle viewMode={viewMode} onViewModeChange={changeRewardsViewMode} labels={VIEW_TOGGLE_LABELS} />
			</div>

			{isLoading ? (
				<SkeletonRegion labels={REWARDS_CATALOG_LOADING_LABELS}>
					<RewardCatalogBones viewMode={viewMode} />
				</SkeletonRegion>
			) : viewMode === "grid" ? (
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{rewards.map((reward, index) => (
						// Only the first card is reliably above the fold; the rest load as they scroll in.
						<RewardCard key={reward.id} reward={reward} detailPathPrefix={detailPathPrefix} priority={index === 0} />
					))}
				</div>
			) : (
				<div className="space-y-2">
					{rewards.map((reward) => (
						<RewardListRow key={reward.id} reward={reward} detailPathPrefix={detailPathPrefix} />
					))}
				</div>
			)}

			{hasPrevious || hasNext ? (
				<div className="flex items-center justify-between gap-3 border-t border-border pt-4">
					<Button type="button" variant="outline" disabled={!hasPrevious} onClick={onPrevious} className="gap-1.5">
						<ChevronLeft className="size-4" aria-hidden="true" />
						Previous
					</Button>
					<p className="text-sm text-muted-foreground tabular-nums">{rewards.length} results</p>
					<Button type="button" variant="outline" disabled={!hasNext} onClick={onNext} className="gap-1.5">
						Next
						<ChevronRight className="size-4" aria-hidden="true" />
					</Button>
				</div>
			) : null}
		</section>
	);
}
