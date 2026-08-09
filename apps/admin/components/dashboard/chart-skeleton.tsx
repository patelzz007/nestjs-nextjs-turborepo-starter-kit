import * as React from "react";

/**
 * Pulse bars for the skeleton chart body. Each entry is unique, so the height
 * doubles as a stable React key (no index keys).
 */
const CHART_BARS: readonly number[] = [40, 62, 48, 74, 58, 88, 68, 96, 78, 55, 92, 70];

/** Horizontal gridlines for the skeleton chart body (stable keys). */
const GRIDLINES: readonly string[] = ["top", "upper", "lower", "bottom"];

/**
 * Chart-shaped loading skeleton, shown while the recharts chunk loads. Mirrors
 * the "Total Visitors" card (title + description + control pills on the right,
 * then a gridlined area chart) so the swap to the real chart is seamless.
 * Decorative pieces are `aria-hidden`; the container carries `role="status"`.
 */
export function ChartSkeleton(): React.JSX.Element {
	return (
		<div role="status" aria-label="Loading chart" className="rounded-lg border bg-card p-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				{/* Title + description */}
				<div className="space-y-2" aria-hidden="true">
					<div className="h-5 w-36 animate-pulse rounded-md bg-muted" />
					<div className="h-3 w-48 animate-pulse rounded-md bg-muted/60" />
				</div>
				{/* Control pills (the range toggle / select) */}
				<div className="flex gap-2" aria-hidden="true">
					<div className="h-8 w-24 animate-pulse rounded-md bg-muted/80" />
					<div className="hidden h-8 w-24 animate-pulse rounded-md bg-muted/80 sm:block" />
					<div className="hidden h-8 w-24 animate-pulse rounded-md bg-muted/80 sm:block" />
				</div>
			</div>

			{/* Chart body: gridlines + pulsing bars */}
			<div className="relative mt-6 h-[250px] w-full" aria-hidden="true">
				<div className="absolute inset-0 flex flex-col justify-between">
					{GRIDLINES.map((line) => (
						<div key={line} className="h-px bg-border/50" />
					))}
				</div>
				<div className="absolute inset-x-4 bottom-0 flex items-end gap-2 sm:inset-x-8">
					{" "}
					{CHART_BARS.map((barHeight) => (
						<div key={barHeight} className="flex-1 animate-pulse rounded-t-md bg-primary/10" style={{ height: `${String(barHeight)}%` }} />
					))}
				</div>
			</div>
		</div>
	);
}
