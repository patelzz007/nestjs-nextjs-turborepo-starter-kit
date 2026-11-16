import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import type * as React from "react";

import { SHOWCASE_COMPONENT_LOADING_LABELS, SHOWCASE_DOCS_LOADING_LABELS, SHOWCASE_LOADING_LABELS } from "@/components/loading/loading-labels";

/** Family jump links in the index header (one per showcase family). */
const FAMILY_LINKS = 8;
/** Component cards drawn under the first family heading — enough to fill the first screen. */
const FIRST_SCREEN_CARDS = 6;
/** Feature links and feature blocks drawn on a component's page. */
const FEATURE_LINKS = 6;
const FIRST_SCREEN_FEATURES = 2;

/**
 * `/showcase` while it streams in: the header and its family links, then a
 * family heading over a grid of component cards — the layout `ShowcasePage`
 * renders (the search bar above it belongs to the layout, already on screen).
 */
export function ShowcasePageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={SHOWCASE_LOADING_LABELS} className="flex w-full flex-col gap-10">
			<div data-skeleton="showcase-header" className="flex flex-col gap-3">
				<Skeleton variant="text" className="h-8 w-64" />
				<Skeleton variant="text" className="h-4 w-full max-w-2xl" />
				<div className="mt-2 flex flex-wrap gap-2">
					{placeholderKeys("family", FAMILY_LINKS).map((key) => (
						<Skeleton key={key} className="h-9 w-28 rounded-md" />
					))}
				</div>
			</div>
			<div className="flex flex-col gap-4">
				<Skeleton data-skeleton="showcase-family" variant="text" className="h-10 w-72" />
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{placeholderKeys("card", FIRST_SCREEN_CARDS).map((key) => (
						<Skeleton key={key} data-skeleton="showcase-card" className="h-32 rounded-xl" />
					))}
				</div>
			</div>
		</SkeletonRegion>
	);
}

/**
 * `/components/<slug>` while it streams in: the component's header (family,
 * name, description, feature links), then feature blocks (a title, a
 * description, the Preview / Code tabs and a preview) — the layout
 * `ShowcaseComponentPage` renders.
 */
export function ShowcaseComponentPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={SHOWCASE_COMPONENT_LOADING_LABELS} className="flex w-full flex-col gap-10">
			<div data-skeleton="showcase-component-header" className="flex flex-col gap-4 border-b pb-8">
				<Skeleton variant="text" className="h-5 w-32" />
				<Skeleton variant="text" className="h-9 w-64" />
				<Skeleton variant="text" className="h-4 w-full max-w-2xl" />
				<div className="flex flex-wrap gap-1.5">
					{placeholderKeys("feature-link", FEATURE_LINKS).map((key) => (
						<Skeleton key={key} className="h-7 w-24 rounded-md" />
					))}
				</div>
			</div>
			{placeholderKeys("feature", FIRST_SCREEN_FEATURES).map((key) => (
				<div key={key} data-skeleton="showcase-feature" className="flex flex-col gap-3">
					<Skeleton variant="text" className="h-5 w-40" />
					<Skeleton variant="text" className="h-4 w-full max-w-xl" />
					<Skeleton className="h-8 w-44 rounded-md" />
					<Skeleton className="h-40 w-full rounded-xl" />
				</div>
			))}
		</SkeletonRegion>
	);
}

/** Lines of prose the docs skeleton draws under each heading. */
const DOCS_PARAGRAPH_LINES = 3;
const DOCS_SECTIONS = 3;

/**
 * `/components/<slug>/docs` while it streams in: the back link, the name and
 * description, then sections of a heading and prose — the layout
 * `ShowcaseDocsPage` renders.
 */
export function ShowcaseDocsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={SHOWCASE_DOCS_LOADING_LABELS} className="flex w-full max-w-3xl flex-col gap-8">
			<div data-skeleton="showcase-docs-header" className="flex flex-col gap-3 border-b pb-6">
				<Skeleton variant="text" className="h-4 w-36" />
				<Skeleton variant="text" className="h-9 w-56" />
				<Skeleton variant="text" className="h-4 w-full max-w-2xl" />
			</div>
			{placeholderKeys("docs-section", DOCS_SECTIONS).map((key) => (
				<div key={key} data-skeleton="showcase-docs-section" className="flex flex-col gap-3">
					<Skeleton variant="text" className="h-6 w-48" />
					{placeholderKeys(`${key}-line`, DOCS_PARAGRAPH_LINES).map((line) => (
						<Skeleton key={line} variant="text" className="h-4 w-full" />
					))}
				</div>
			))}
		</SkeletonRegion>
	);
}
