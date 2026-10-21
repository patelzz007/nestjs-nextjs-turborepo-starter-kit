"use client";

import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/**
 * The resting `AnalyticsRangePicker` row, sized like the real one (two labelled `h-10` menus and the
 * range line), for the `next/dynamic` boundary that keeps the picker's calendar out of the page
 * chunk. It lives apart from the picker so importing it loads no calendar code.
 */
export const AnalyticsRangePickerSkeleton = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function AnalyticsRangePickerSkeleton(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} data-slot="analytics-range-picker-skeleton" aria-hidden="true" className={cn("flex flex-col gap-3", className)} {...props}>
			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<Skeleton variant="text" className="h-3 w-12" />
					<Skeleton className="h-10 min-w-44" />
				</div>
				<div className="flex flex-col gap-1.5">
					<Skeleton variant="text" className="h-3 w-14" />
					<Skeleton className="h-10 min-w-28" />
				</div>
				<div className="flex items-center pb-2">
					<Skeleton variant="text" className="h-4 w-48" />
				</div>
			</div>
		</div>
	);
});
AnalyticsRangePickerSkeleton.displayName = "AnalyticsRangePickerSkeleton";
