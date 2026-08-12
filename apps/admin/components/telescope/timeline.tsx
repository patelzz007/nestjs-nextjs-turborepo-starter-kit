"use client";

// ============================================
// components/telescope/timeline.tsx
// The killer feature (docs/telescope.md §9.3): renders a request's spans as
// proportional horizontal bars, colored by kind, so a slow step (N+1 Prisma,
// a chatty guard) is visible at a glance.
//
// Dumb component: spans + the request duration arrive via props. Bars are
// linear in duration with a minimum visible width so tiny spans don't vanish;
// the duration label and kind name are the accessible fallback (the bar itself
// carries an aria-label describing name + duration).
// ============================================

import { cn } from "@workspace/ui/lib/utils";

import type { TelescopeSpan } from "@workspace/shared";

import { durationLabel, spanKindMeta } from "@/lib/telescope";

export interface TimelineProps {
	readonly spans: readonly TelescopeSpan[];
	/** Total request duration — the denominator for bar widths. */
	readonly totalMs: number;
}

/** Minimum visible bar width (%) so sub-ms spans still show a sliver. */
const MIN_BAR_PCT: number = 2;

/** Renders one span row. The per-row closure stays inside this component. */
function SpanRow({ span, totalMs }: { readonly span: TelescopeSpan; readonly totalMs: number }): React.JSX.Element {
	const meta = spanKindMeta(span.kind);
	const rawPct: number = totalMs > 0 ? (span.durationMs / totalMs) * 100 : 0;
	const widthPct: number = Math.max(MIN_BAR_PCT, rawPct);

	return (
		<li className="flex items-center gap-3" aria-label={`${meta.label} — ${durationLabel(span.durationMs)}`}>
			<div className="flex w-40 shrink-0 items-baseline justify-between gap-2">
				<span className="truncate text-xs font-medium text-foreground">{span.name}</span>
				<span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{durationLabel(span.durationMs)}</span>
			</div>
			<div className="h-5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50" role="img" aria-label={`${span.name}: ${durationLabel(span.durationMs)}`}>
				<div className={cn("h-full rounded-full opacity-90 transition-all", meta.barClass)} style={{ width: `${String(widthPct)}%` }} />
			</div>
			<span className="hidden w-24 shrink-0 text-right text-[11px] text-muted-foreground sm:block">{meta.label}</span>
		</li>
	);
}

/**
 * Timeline — a vertical stack of proportional span bars, slowest-first
 * visual reading left-to-right. Empty spans render a muted placeholder.
 */
export function Timeline({ spans, totalMs }: TimelineProps): React.JSX.Element {
	if (spans.length === 0) {
		return <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No spans recorded for this request.</p>;
	}

	return (
		<div className="space-y-1.5">
			{/* Scale footer — the whole row maps to the request duration. */}
			<div className="flex items-center justify-between text-[11px] text-muted-foreground">
				<span>request start</span>
				<span className="font-medium tabular-nums text-foreground">{durationLabel(totalMs)}</span>
			</div>
			<ul role="list" className="space-y-1.5">
				{spans.map((span) => (
					<SpanRow key={`${span.name}-${span.startOffsetMs}`} span={span} totalMs={totalMs} />
				))}
			</ul>
		</div>
	);
}
