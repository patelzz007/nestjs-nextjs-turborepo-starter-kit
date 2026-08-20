"use client";

// ============================================
// components/telescope/timeline.tsx
// Improvement 9 — true waterfall. Spans are packed into lanes (greedy first-
// fit by start offset) so overlapping steps — e.g. parallel Prisma queries —
// render side by side instead of stacking. Bars are proportional to duration,
// colored by kind, with a hover tooltip showing the exact ms range.
//
// Dumb component: spans + the request duration arrive via props.
// ============================================

import { cn } from "@workspace/ui/lib/utils";
import { useMemo } from "react";

import type { QueryLogEntry, TelescopeSpan } from "@workspace/shared";

import { durationLabel, spanKindMeta } from "@/lib/telescope";

export interface TimelineQueryOverlay {
	readonly query: QueryLogEntry;
	/** Offset from the request start (ms) — same value the span uses. */
	readonly startOffsetMs: number;
}

export interface TimelineProps {
	readonly spans: readonly TelescopeSpan[];
	/** Total request duration — the denominator for bar widths. */
	readonly totalMs: number;
	/** Feature 11 — SQL queries rendered as bars on the same axis. */
	readonly queries?: readonly TimelineQueryOverlay[];
}

/** Minimum visible bar width (px) so sub-ms spans still show a sliver. */
const MIN_BAR_PX = 3;

/** A lane: a list of spans sorted by start offset, plus its current end. */
interface Lane {
	readonly spans: TelescopeSpan[];
	endOffsetMs: number;
}

/**
 * Greedy first-fit lane packing: assign each span (sorted by start) to the
 * first lane whose last span has already finished; open a new lane otherwise.
 * Overlapping spans land in different lanes — that's the waterfall.
 */
function packLanes(spans: readonly TelescopeSpan[]): readonly Lane[] {
	const sorted: readonly TelescopeSpan[] = [...spans].sort((a: TelescopeSpan, b: TelescopeSpan): number => a.startOffsetMs - b.startOffsetMs);
	const lanes: Lane[] = [];

	for (const span of sorted) {
		let placed = false;
		for (const lane of lanes) {
			if (span.startOffsetMs >= lane.endOffsetMs) {
				lane.spans.push(span);
				lane.endOffsetMs = span.startOffsetMs + span.durationMs;
				placed = true;
				break;
			}
		}
		if (!placed) {
			lanes.push({ spans: [span], endOffsetMs: span.startOffsetMs + span.durationMs });
		}
	}
	return lanes;
}

/**
 * Timeline — a waterfall of proportional span bars. The container maps 0 →
 * request start and `totalMs` → request end; each bar is absolutely
 * positioned by `startOffsetMs` and sized by `durationMs`. Hovering a bar
 * reveals its exact timing in a floating tooltip.
 */ export function Timeline({ spans, totalMs, queries }: TimelineProps): React.JSX.Element {
	const lanes: readonly Lane[] = useMemo((): readonly Lane[] => packLanes(spans), [spans]);

	if (spans.length === 0 && (queries === undefined || queries.length === 0)) {
		return <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No spans recorded for this request.</p>;
	}

	const laneHeight: number = lanes.length > 0 ? lanes.length * 34 : 34;
	const queryLaneHeight: number = queries !== undefined && queries.length > 0 ? 34 : 0;

	return (
		<div className="space-y-3">
			{/* Scale footer — the whole row maps to the request duration. */}
			<div className="flex items-center justify-between text-[11px] text-muted-foreground">
				<span>request start</span>
				<span className="font-medium text-foreground tabular-nums">{durationLabel(totalMs)}</span>
			</div>

			{/* Waterfall canvas */}
			<div className="relative overflow-hidden rounded-lg border bg-muted/20" style={{ height: `${String(laneHeight + queryLaneHeight)}px` }}>
				{/* Time-grid backdrop: quarter markers so the eye can estimate offsets. */}
				<div className="pointer-events-none absolute inset-0 flex">
					{[0, 1, 2, 3].map((quarter: number) => (
						<div key={quarter} className="h-full flex-1 border-r border-border/40 last:border-r-0" />
					))}
				</div>{" "}					{lanes.map((lane, laneIndex) => (
						<div key={`lane-${laneIndex}`} className="relative h-[30px] border-b border-border/20 last:border-b-0" style={{ top: `${String(laneIndex * 34)}px` }}>
							{lane.spans.map((span) => {
							const meta = spanKindMeta(span.kind);
							const leftPct: number = totalMs > 0 ? (span.startOffsetMs / totalMs) * 100 : 0;
							const rawPct: number = totalMs > 0 ? (span.durationMs / totalMs) * 100 : 0;
							const widthPct: number = rawPct > 0 ? Math.max((MIN_BAR_PX / (totalMs > 0 ? (totalMs * 4) / 100 : 1)) * 10, rawPct) : rawPct;
							const endMs: number = span.startOffsetMs + span.durationMs;

							return (
								<div
									key={`span-${span.name}-${span.startOffsetMs}-${span.durationMs}`}
									className={cn("group absolute top-1/2 h-5 -translate-y-1/2 rounded-md opacity-90 transition-opacity hover:opacity-100", meta.barClass)}
									style={{ left: `${String(Math.min(99, leftPct))}%`, width: `${String(Math.min(100 - leftPct, widthPct))}%` }}
									role="img"
									aria-label={`${span.name} (${meta.label}): ${durationLabel(span.durationMs)}`}>
									{/* Hover tooltip — floats above the bar. */}
									<span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[11px] whitespace-nowrap text-popover-foreground shadow-md group-hover:block">
										<span className="font-medium">{span.name}</span>
										<span className="ml-1.5 text-muted-foreground">{meta.label}</span>
										<span className="ml-1.5 tabular-nums">
											+{String(Math.round(span.startOffsetMs))}ms → +{String(endMs)}ms ({durationLabel(span.durationMs)})
										</span>
									</span>
								</div>
							);
						})}
					</div>
				))}
				{/* Feature 11 — SQL query overlay: one bar per query on the same axis,
				    positioned by startOffsetMs, tooltip shows the SQL text. */}
				{queries !== undefined && queries.length > 0 ? (
					<div className="relative h-[30px] border-t border-border/30" style={{ top: `${String(laneHeight)}px` }}>
						{queries.map((overlay, index) => {
							const leftPct: number = totalMs > 0 ? (overlay.startOffsetMs / totalMs) * 100 : 0;
							const rawPct: number = totalMs > 0 ? (overlay.query.durationMs / totalMs) * 100 : 0;
							const widthPct: number = rawPct > 0 ? Math.max((MIN_BAR_PX / (totalMs > 0 ? (totalMs * 4) / 100 : 1)) * 10, rawPct) : rawPct;
							const endMs: number = overlay.startOffsetMs + overlay.query.durationMs;

							return (
								<div
									key={`query-${overlay.query.operation}-${overlay.query.model}-${overlay.startOffsetMs}`}
									className="group absolute top-1/2 h-5 -translate-y-1/2 rounded-md bg-violet-400/80 opacity-90 transition-opacity hover:opacity-100 dark:bg-violet-500/70"
									style={{ left: `${String(Math.min(99, leftPct))}%`, width: `${String(Math.min(100 - leftPct, widthPct))}%` }}
									role="img"
									aria-label={`SQL ${overlay.query.operation} on ${overlay.query.model}: ${durationLabel(overlay.query.durationMs)}`}>
									{/* Hover tooltip — the SQL text (truncated for the popover). */}
									<span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden w-64 -translate-x-1/2 rounded-md border bg-popover p-2 text-[11px] text-popover-foreground shadow-md group-hover:block">
										<span className="block truncate font-mono">{overlay.query.query}</span>
										<span className="mt-1 block text-muted-foreground">
											{overlay.query.operation} · {overlay.query.model || "(unknown table)"} · +{String(Math.round(overlay.startOffsetMs))}ms → +{String(endMs)}ms (
											{durationLabel(overlay.query.durationMs)})
										</span>
									</span>
								</div>
							);
						})}
						{}
					</div>
				) : null}
			</div>

			{/* Legend — index keys: name+offset collides for same-ms queries (static list). */}
			<ul className="flex flex-wrap gap-x-4 gap-y-1.5">					{spans.map((span) => {
					const meta = spanKindMeta(span.kind);
					return (							<li key={`legend-${span.name}-${span.kind}-${span.startOffsetMs}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
							<span aria-hidden className={cn("size-2 rounded-full", meta.barClass)} />
							<span className="max-w-40 truncate">{span.name}</span>
							<span className="tabular-nums">{durationLabel(span.durationMs)}</span>
						</li>
					);
				})}
				{queries !== undefined && queries.length > 0 ? (
					<li className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
						<span aria-hidden className="size-2 rounded-full bg-violet-400 dark:bg-violet-500" />
						<span>SQL</span>
						<span className="tabular-nums">
							{String(queries.length)} quer{queries.length === 1 ? "y" : "ies"}
						</span>
					</li>
				) : null}
			</ul>
		</div>
	);
}
