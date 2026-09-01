"use client";

import { RewardCard } from "@/components/rewardhub/reward-card";
import { RewardListRow } from "@/components/rewardhub/reward-list-row";
import { RewardHubViewToggle } from "@/components/rewardhub/rewardhub-view-toggle";
import { useRewardHubViewMode } from "@/components/rewardhub/use-rewardhub-view-mode";
import type { RewardResponse } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

export interface RewardHubCatalogProps {
	readonly rewards: readonly RewardResponse[];
	readonly isLoading: boolean;
	readonly total: number;
	readonly page: number;
	readonly hasNext: boolean;
	readonly hasPrevious: boolean;
	readonly onPageChange: (page: number) => void;
	readonly detailPathPrefix?: string;
}

function CatalogSkeleton({ viewMode }: { readonly viewMode: "grid" | "list" }): React.JSX.Element {
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

/** Consumer rewards collection with grid/list toggle and pagination. */
export function RewardHubCatalog({
	rewards,
	isLoading,
	total,
	page,
	hasNext,
	hasPrevious,
	onPageChange,
	detailPathPrefix = "/rewardhub",
}: RewardHubCatalogProps): React.JSX.Element {
	const { viewMode, setViewMode } = useRewardHubViewMode();

	const handlePrevious = React.useCallback((): void => {
		onPageChange(page - 1);
	}, [onPageChange, page]);

	const handleNext = React.useCallback((): void => {
		onPageChange(page + 1);
	}, [onPageChange, page]);

	const resultLabel = isLoading ? "Loading offers…" : `${String(rewards.length)} on this page · ${total.toLocaleString()} total`;

	return (
		<section className="space-y-4" aria-label="Rewards catalog">
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/25 px-4 py-3">
				<div className="min-w-0">
					<p className="text-sm font-medium text-foreground">{resultLabel}</p>
					<p className="text-xs text-muted-foreground">Switch layout to compare offers at a glance.</p>
				</div>
				<RewardHubViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
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
					<Button type="button" variant="outline" disabled={!hasPrevious} onClick={handlePrevious} className="gap-1.5">
						<ChevronLeft className="size-4" aria-hidden="true" />
						Previous
					</Button>
					<p className="text-sm text-muted-foreground tabular-nums">Page {page}</p>
					<Button type="button" variant="outline" disabled={!hasNext} onClick={handleNext} className="gap-1.5">
						Next
						<ChevronRight className="size-4" aria-hidden="true" />
					</Button>
				</div>
			) : null}
		</section>
	);
}
