"use client";

import { RewardCard } from "@/components/rewardhub/browse/card";
import { RewardListRow } from "@/components/rewardhub/browse/list-row";
import { RewardsViewToggle, type RewardsViewToggleLabels } from "@workspace/client/lib/features/ui-preferences/rewards-view-toggle";
import { useRewardsViewMode, useUiPreferencesCommands, type RewardsViewMode } from "@workspace/client/lib/features/ui-preferences/facade";
import type { RewardResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { ROUTE_PREFIXES } from "@/lib/routes";

const VIEW_TOGGLE_LABELS: RewardsViewToggleLabels = { group: "Rewards layout", grid: "Grid view", list: "List view" };

export interface RewardHubCatalogProps {
	readonly rewards: readonly RewardResponse[];
	readonly isLoading: boolean;
	readonly hasNext: boolean;
	readonly hasPrevious: boolean;
	readonly onNext: () => void;
	readonly onPrevious: () => void;
	readonly detailPathPrefix?: string;
}

function CatalogSkeleton({ viewMode }: { readonly viewMode: RewardsViewMode }): React.JSX.Element {
	if (viewMode === "list") {
		return (
			<div className="space-y-2">
				{Array.from({ length: 5 }, (_, index) => (
					<Skeleton key={index} className="h-16 w-full rounded-xl" />
				))}
			</div>
		);
	}

	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{Array.from({ length: 6 }, (_, index) => (
				<Skeleton key={index} className="h-80 w-full rounded-2xl" />
			))}
		</div>
	);
}

/** Consumer rewards collection with grid/list toggle and cursor pagination. */
export function RewardHubCatalog({
	rewards,
	isLoading,
	hasNext,
	hasPrevious,
	onNext,
	onPrevious,
	detailPathPrefix = ROUTE_PREFIXES.rewardHubRewards,
}: RewardHubCatalogProps): React.JSX.Element {
	const viewMode = useRewardsViewMode();
	const { changeRewardsViewMode } = useUiPreferencesCommands();

	const resultLabel = isLoading ? "Loading offers…" : `Showing ${String(rewards.length)} offers`;

	return (
		<section className="space-y-4" aria-label="Rewards catalog">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/25 px-4 py-3">
				<div className="min-w-0">
					<p className="text-sm font-medium text-foreground">{resultLabel}</p>
					<p className="text-xs text-muted-foreground">Switch layout to compare offers at a glance.</p>
				</div>
				<RewardsViewToggle viewMode={viewMode} onViewModeChange={changeRewardsViewMode} labels={VIEW_TOGGLE_LABELS} />
			</div>

			{isLoading ? (
				<CatalogSkeleton viewMode={viewMode} />
			) : viewMode === "grid" ? (
				<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{rewards.map((reward) => (
						<RewardCard key={reward.id} reward={reward} detailPathPrefix={detailPathPrefix} />
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
