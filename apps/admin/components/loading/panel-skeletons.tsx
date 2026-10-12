import { Skeleton } from "@workspace/ui/components/skeleton";
import { PageHeaderSkeleton, TableSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type * as React from "react";

import { PANEL_LOADING_LABELS, type SkeletonRegionLabelsOverride } from "@/components/loading/loading-labels";

export interface PanelContentSkeletonProps {
	/** What the region announces. Default "Loading page…". */
	readonly labels?: SkeletonRegionLabelsOverride;
}

/**
 * The content area of a panel page whose exact shape isn't known — the
 * `(panel)` fallback and the route guard's wait. Most panel pages are a page
 * header over a card-wrapped table, so that is the silhouette.
 */
export function PanelContentSkeleton({ labels = PANEL_LOADING_LABELS }: PanelContentSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className="flex flex-col gap-6">
			<PageHeaderSkeleton />
			<TableSkeleton />
		</SkeletonRegion>
	);
}

/** The panel's 404 (`AdminNotFoundContent`): the faded code, title, message and back link, centred. */
export function PanelNotFoundSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={PANEL_LOADING_LABELS} className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 py-16">
			<Skeleton data-skeleton="not-found-code" className="h-15 w-28" />
			<div className="flex flex-col items-center gap-2">
				<Skeleton variant="text" className="h-5 w-40" />
				<Skeleton variant="text" className="h-3.5 w-80 max-w-full" />
				<Skeleton variant="text" className="h-3.5 w-64 max-w-full" />
			</div>
			<Skeleton className="h-9 w-44" />
		</SkeletonRegion>
	);
}
