import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

import { SECTION_LOADING_LABELS, type SkeletonRegionLabelsOverride } from "@/components/loading/loading-labels";

export interface SectionBonesProps {
	/** The section's reserved height (e.g. `h-40`), so nothing below it jumps when it mounts. */
	readonly height: string;
}

/** A gallery/demo section at its reserved height: a bordered card with a title, a description line and a body that fills the rest. */
export function SectionBones({ height }: SectionBonesProps): React.JSX.Element {
	return (
		<div data-skeleton="section" className={cn("flex flex-col gap-3 overflow-hidden rounded-lg border bg-card p-4", height)}>
			<Skeleton variant="text" className="h-4 w-40" />
			<Skeleton variant="text" className="h-3.5 w-72 max-w-full" />
			<Skeleton className="min-h-0 w-full flex-1" />
		</div>
	);
}

export interface SectionSkeletonProps extends SectionBonesProps {
	/** What the region announces. Default "Loading section…". */
	readonly labels?: SkeletonRegionLabelsOverride;
}

/** A lazily mounted section while it loads — `SectionBones` in its own announced region. */
export function SectionSkeleton({ height, labels = SECTION_LOADING_LABELS }: SectionSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className="block">
			<SectionBones height={height} />
		</SkeletonRegion>
	);
}
