"use client";

import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

/** The `skeletonRegion` family of `UiKitLabels`. */
export interface SkeletonRegionLabels {
	/** What a screen reader announces while the region's content loads, e.g. "Loading…" or "Loading claims…". */
	readonly loading: string;
}

export interface SkeletonRegionProps extends Omit<React.ComponentProps<"div">, "role" | "aria-busy" | "aria-live"> {
	/** Per-usage override of the announcement — name what is loading when the page knows it. */
	readonly labels?: UiKitLabelsOverride<"skeletonRegion"> | undefined;
}

/**
 * The accessible frame around any loading skeleton: one polite `status`
 * announcement for the whole region, while the bones themselves stay out of
 * the accessibility tree. The region holds back for a beat before it fades in
 * (`skeleton-region` in styles/components.css), so a fast load never flashes.
 *
 * Layout classes passed in `className` apply to the bones directly — the
 * hidden wrapper is `display: contents`, and the announcement is `sr-only`
 * (absolutely positioned), so it never takes a grid cell or flex slot.
 * Space children with flex/grid `gap`: `space-y-*` targets direct children,
 * and the only direct child here is the hidden wrapper, so it has no effect.
 */
export const SkeletonRegion = React.forwardRef<HTMLDivElement, SkeletonRegionProps>(function SkeletonRegion(
	{ className, labels: labelsOverride, children, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("skeletonRegion", labelsOverride);
	return (
		<div ref={ref} role="status" aria-live="polite" aria-busy="true" data-slot="skeleton-region" className={cn("skeleton-region", className)} {...props}>
			<span className="sr-only">{labels.loading}</span>
			<div aria-hidden="true" className="contents">
				{children}
			</div>
		</div>
	);
});
SkeletonRegion.displayName = "SkeletonRegion";
