import { Skeleton } from "@workspace/ui/components/skeleton";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

/*
 * Small bone groups the admin's page skeletons share — the silhouettes of
 * admin-specific surfaces the kit's patterns don't cover (a bordered queue
 * row, a labelled value, a card heading inside a custom card). Bones only:
 * every caller wraps them in exactly one `SkeletonRegion`.
 */

export interface CardHeadingSkeletonProps {
	/** Draw the `CardDescription` line under the title. Default true. */
	readonly withDescription?: boolean;
	readonly className?: string;
}

/** A `CardTitle` (+ `CardDescription`) silhouette, for cards the kit patterns don't draw. */
export function CardHeadingSkeleton({ withDescription = true, className }: CardHeadingSkeletonProps): React.JSX.Element {
	return (
		<div className={cn("flex min-w-0 flex-col gap-2", className)}>
			<Skeleton variant="text" className="h-4.5 w-40 max-w-full" />
			{withDescription ? <Skeleton variant="text" className="h-3.5 w-72 max-w-full" /> : null}
		</div>
	);
}

/** Widths of labelled values, cycled so a column of them reads like real, ragged data. */
const FIELD_VALUE_WIDTHS: readonly string[] = ["w-3/4", "w-1/2", "w-2/3", "w-2/5"];

export interface LabelledValueSkeletonProps {
	/** Position in its list — picks a ragged value width. */
	readonly index: number;
	readonly className?: string;
}

/** A small uppercase label over a value — the `<dt>`/`<dd>` pair of the admin's detail sheets. */
export function LabelledValueSkeleton({ index, className }: LabelledValueSkeletonProps): React.JSX.Element {
	return (
		<div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
			<Skeleton variant="text" className="h-3 w-24" />
			<Skeleton variant="text" className={cn("h-3.5", FIELD_VALUE_WIDTHS[index % FIELD_VALUE_WIDTHS.length])} />
		</div>
	);
}

export interface LabelledValueGridSkeletonProps {
	readonly count: number;
	/** The grid's column classes — the same ones the real `<dl>` uses. */
	readonly className?: string;
}

/** A grid of labelled values (`dl.grid`), `count` cells long. */
export function LabelledValueGridSkeleton({ count, className }: LabelledValueGridSkeletonProps): React.JSX.Element {
	return (
		<div className={cn("grid gap-4", className)}>
			{placeholderKeys("value", count).map((key, index) => (
				<LabelledValueSkeleton key={key} index={index} />
			))}
		</div>
	);
}

export interface BadgeSkeletonProps {
	readonly className?: string;
}

/** A status `Badge` silhouette. */
export function BadgeSkeleton({ className }: BadgeSkeletonProps): React.JSX.Element {
	return <Skeleton className={cn("h-5 w-16 rounded-full", className)} />;
}
