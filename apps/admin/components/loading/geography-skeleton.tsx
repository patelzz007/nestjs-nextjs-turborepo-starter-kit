import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { PageHeaderSkeleton, TableSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type * as React from "react";

import { GEOGRAPHY_LOADING_LABELS } from "@/components/loading/loading-labels";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { TABLE_PAGE_SKELETON_ROWS } from "@/components/loading/table-page-skeleton";

/** Regions, subregions, countries, states, cities — one stat card each. */
const GEO_STAT_CARDS = 5;
/** The countries tab (the default): select + ID, Name, ISO2, Active, Lat, Lng. */
const GEO_TABLE_COLUMNS = 7;

/**
 * `/geography`: header, the five stat cards, the segmented tab control, then
 * the bare (card-less) data table — the `p-6` page the real view renders.
 */
export function GeographyPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={GEOGRAPHY_LOADING_LABELS} className="flex flex-col gap-6 p-6">
			<PageHeaderSkeleton />
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				{placeholderKeys("stat", GEO_STAT_CARDS).map((key) => (
					<Card key={key} data-skeleton="geo-stat-card">
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<Skeleton variant="text" className="h-3.5 w-20" />
							<Skeleton className="size-4 rounded-sm" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-8 w-24" />
						</CardContent>
					</Card>
				))}
			</div>
			<div className="flex flex-col gap-4">
				<Skeleton data-skeleton="geo-tabs" className="h-11 w-96 max-w-full rounded-xl" />
				<TableSkeleton surface="plain" rows={TABLE_PAGE_SKELETON_ROWS} columns={GEO_TABLE_COLUMNS} />
			</div>
		</SkeletonRegion>
	);
}
