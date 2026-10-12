import { cycledWidth, placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import type { RewardsViewMode } from "@workspace/client/lib/features/ui-preferences/facade";
import { PilotCitySchema, RewardCategorySchema } from "@workspace/shared";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/*
 * Bones for the rewards catalog — `RewardCard` / `RewardListRow` silhouettes
 * and the browse page around them (summary header, filter bar, catalog
 * toolbar). Bones only: wrap them in one `SkeletonRegion`.
 */

/** Two rows of the three-column grid — enough to fill the first screen, without implying how many offers are coming. */
const CATALOG_SKELETON_ITEMS = 6;

/** "All cities" + one chip per pilot city, as the filter bar draws them. */
const CITY_CHIP_COUNT = PilotCitySchema.options.length + 1;
/** "All" + one chip per reward category. */
const CATEGORY_CHIP_COUNT = RewardCategorySchema.options.length + 1;
/** The summary tiles in the dashboard header: showing, cities, categories. */
const SUMMARY_TILE_COUNT = 3;

const TITLE_WIDTHS: readonly string[] = ["w-3/4", "w-2/3", "w-4/5", "w-3/5"];
const MERCHANT_WIDTHS: readonly string[] = ["w-28", "w-36", "w-24", "w-32"];
const CHIP_WIDTHS: readonly string[] = ["w-24", "w-20", "w-28", "w-16"];

/** A `RewardCard` silhouette: merchant header, title and copy, availability bar and expiry, the full-width action. */
export function RewardCardSkeleton({ index }: { readonly index: number }): React.JSX.Element {
	return (
		<div data-slot="reward-card-skeleton" className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
			<div className="flex items-start gap-3 border-b border-border/80 p-4">
				<Skeleton className="size-12 rounded-xl" />
				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<Skeleton variant="text" className={cn("my-0.5 h-4", cycledWidth(MERCHANT_WIDTHS, index, "w-28"))} />
					<div className="flex gap-2">
						<Skeleton variant="text" className="h-5 w-16" />
						<Skeleton variant="text" className="h-5 w-20" />
					</div>
				</div>
			</div>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-3">
				<div className="flex flex-col gap-2">
					<Skeleton variant="text" className={cn("my-0.5 h-5", cycledWidth(TITLE_WIDTHS, index, "w-3/4"))} />
					<div className="flex flex-col gap-2 py-0.5">
						<Skeleton variant="text" className="h-3.5 w-full" />
						<Skeleton variant="text" className="h-3.5 w-2/3" />
					</div>
				</div>
				<div className="mt-auto flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center justify-between gap-2">
							<Skeleton variant="text" className="my-0.5 h-3 w-16" />
							<Skeleton variant="text" className="my-0.5 h-3 w-20" />
						</div>
						<Skeleton variant="text" className="h-1.5 w-full" />
					</div>
					<Skeleton variant="text" className="my-0.5 h-3 w-36" />
				</div>
			</div>
			<div className="border-t border-border/80 p-3">
				<Skeleton className="h-10 w-full" />
			</div>
		</div>
	);
}

/** A `RewardListRow` silhouette: avatar, title and meta line, compact availability (md+), count (xl+), the "View" button. */
export function RewardListRowSkeleton({ index }: { readonly index: number }): React.JSX.Element {
	return (
		<div data-slot="reward-list-row-skeleton" className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-3.5 py-3 shadow-xs sm:gap-4 sm:px-4 sm:py-3.5">
			<Skeleton className="size-10 rounded-lg" />
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<Skeleton variant="text" className={cn("my-1 h-4", cycledWidth(TITLE_WIDTHS, index, "w-3/4"))} />
				<Skeleton variant="text" className="my-0.5 h-3 w-4/5 max-w-80" />
			</div>
			<div className="hidden w-24 items-center gap-2 md:flex lg:w-28">
				<Skeleton variant="text" className="h-1 flex-1" />
				<Skeleton variant="text" className="h-3 w-10" />
			</div>
			<Skeleton variant="text" className="hidden h-3 w-12 xl:block" />
			<Skeleton className="size-9 sm:w-18" />
		</div>
	);
}

export interface RewardCatalogBonesProps {
	/** The visitor's saved layout — the bones take the same shape the catalog will. */
	readonly viewMode: RewardsViewMode;
}

/** The catalog body — a card grid or a stack of list rows, matching `RewardHubCatalog`'s two layouts. */
export function RewardCatalogBones({ viewMode }: RewardCatalogBonesProps): React.JSX.Element {
	const keys = placeholderKeys("reward", CATALOG_SKELETON_ITEMS);
	if (viewMode === "list") {
		return (
			<div className="space-y-2">
				{keys.map((key, index) => (
					<RewardListRowSkeleton key={key} index={index} />
				))}
			</div>
		);
	}
	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{keys.map((key, index) => (
				<RewardCardSkeleton key={key} index={index} />
			))}
		</div>
	);
}

/** The catalog's toolbar — result count and hint on the left, the grid/list toggle on the right. */
function CatalogToolbarSkeleton(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/25 px-4 py-3">
			<div className="flex min-w-0 flex-col">
				<Skeleton variant="text" className="my-0.5 h-4 w-32" />
				<Skeleton variant="text" className="my-0.5 h-3 w-56 max-w-full" />
			</div>
			<Skeleton className="h-9 w-18" />
		</div>
	);
}

/** A row of filter chips with its small uppercase label. */
function FilterChipRowSkeleton({ chips, labelWidth }: { readonly chips: number; readonly labelWidth: string }): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Skeleton variant="text" className={cn("h-3", labelWidth)} />
			{placeholderKeys("chip", chips).map((key, index) => (
				<Skeleton key={key} variant="text" className={cn("h-9", cycledWidth(CHIP_WIDTHS, index, "w-20"))} />
			))}
		</div>
	);
}

/** The `RewardHubFilters` card: search field, then the city and category chip rows. */
function FiltersSkeleton(): React.JSX.Element {
	return (
		<div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-5">
			<Skeleton className="h-11 w-full rounded-xl" />
			<div className="space-y-3">
				<FilterChipRowSkeleton chips={CITY_CHIP_COUNT} labelWidth="w-12" />
				<FilterChipRowSkeleton chips={CATEGORY_CHIP_COUNT} labelWidth="w-16" />
			</div>
		</div>
	);
}

/** The dashboard variant's header card: eyebrow, title and intro over three summary tiles. */
function BrowseHeaderSkeleton(): React.JSX.Element {
	return (
		<div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
			<div className="flex flex-col border-b border-border/80 bg-secondary/40 px-5 py-6 sm:px-8 sm:py-8">
				<Skeleton variant="text" className="my-0.5 h-3 w-20" />
				<Skeleton className="mt-2.5 mb-0.5 h-7 w-72 max-w-full sm:h-8" />
				<Skeleton variant="text" className="mt-3 mb-1 h-3.5 w-full max-w-xl" />
			</div>
			<div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
				{placeholderKeys("summary", SUMMARY_TILE_COUNT).map((key) => (
					<div key={key} className="flex items-center gap-3 rounded-xl border border-border/80 bg-background px-4 py-3">
						<Skeleton className="size-9 rounded-lg" />
						<div className="flex min-w-0 flex-1 flex-col">
							<Skeleton variant="text" className="my-0.5 h-3 w-16" />
							<Skeleton className="my-0.5 h-6 w-10" />
							<Skeleton variant="text" className="my-0.5 h-3 w-28 max-w-full" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

/** The landing variant's section heading: `h2` and one line of intro. */
function LandingCatalogHeadingSkeleton(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-2">
			<Skeleton className="my-0.5 h-7 w-64 max-w-full sm:h-8" />
			<Skeleton variant="text" className="my-1 h-3.5 w-full max-w-xl" />
		</div>
	);
}

export interface RewardBrowseBonesProps extends RewardCatalogBonesProps {
	/** Same switch as `RewardHubBrowseView`: the dashboard's summary header, or the landing section's heading. */
	readonly variant: "landing" | "dashboard";
}

/** The whole `RewardHubBrowseView` — header, filters, catalog toolbar and body, in its `space-y-8` rhythm. */
export function RewardBrowseBones({ variant, viewMode }: RewardBrowseBonesProps): React.JSX.Element {
	return (
		<div className="space-y-8">
			{variant === "dashboard" ? <BrowseHeaderSkeleton /> : <LandingCatalogHeadingSkeleton />}
			<FiltersSkeleton />
			<div className="space-y-4">
				<CatalogToolbarSkeleton />
				<RewardCatalogBones viewMode={viewMode} />
			</div>
		</div>
	);
}
