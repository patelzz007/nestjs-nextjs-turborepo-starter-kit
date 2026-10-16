import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import type * as React from "react";

import { COMPONENT_GALLERY_LOADING_LABELS, COMPONENT_PAGE_LOADING_LABELS } from "@/components/loading/loading-labels";
import { SectionBones } from "@/components/loading/section-skeleton";

/** Component cards drawn under the first family heading — enough to fill the first screen. */
const FIRST_SCREEN_CARDS = 6;
/** Stats in the overview header (components, examples, families). */
const HEADER_STATS = 3;

/**
 * `/components` while it streams in (inside the gallery layout, beside its
 * navigation): the header card with its stats, then a family heading over a
 * grid of component cards — the layout `GalleryOverview` renders.
 */
export function ComponentGalleryPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={COMPONENT_GALLERY_LOADING_LABELS} className="flex w-full flex-col gap-12">
			<div data-skeleton="component-gallery-header" className="flex flex-col gap-4 rounded-2xl border bg-card p-6 sm:p-10">
				<Skeleton variant="text" className="h-5 w-28" />
				<Skeleton variant="text" className="h-9 w-56" />
				<Skeleton variant="text" className="h-4 w-full max-w-xl" />
				<div className="mt-2 flex gap-10">
					{placeholderKeys("stat", HEADER_STATS).map((key) => (
						<Skeleton key={key} variant="text" className="h-12 w-24" />
					))}
				</div>
			</div>
			<div className="flex flex-col gap-4">
				<Skeleton data-skeleton="component-gallery-family" variant="text" className="h-10 w-64" />
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
					{placeholderKeys("card", FIRST_SCREEN_CARDS).map((key) => (
						<Skeleton key={key} data-skeleton="component-gallery-card" className="h-36 rounded-xl" />
					))}
				</div>
			</div>
		</SkeletonRegion>
	);
}

/**
 * `/components/<slug>` while it streams in: the component's header (family,
 * name, description, badges), then its live demo — the layout
 * `ComponentPage` renders.
 */
export function ComponentPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={COMPONENT_PAGE_LOADING_LABELS} className="flex w-full flex-col gap-12">
			<div data-skeleton="component-page-header" className="flex flex-col gap-4 border-b pb-8">
				<Skeleton variant="text" className="h-5 w-32" />
				<Skeleton variant="text" className="h-9 w-64" />
				<Skeleton variant="text" className="h-4 w-full max-w-2xl" />
				<Skeleton variant="text" className="h-6 w-40" />
			</div>
			<SectionBones height="h-72" />
		</SkeletonRegion>
	);
}
