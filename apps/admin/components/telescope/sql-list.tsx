"use client";

// ============================================
// components/telescope/sql-list.tsx
// Query list for the request detail view. Each query gets a card with the
// model/operation, duration and a <details> disclosure for the SQL text +
// sanitized bind params. Dumb: queries arrive via props.
// ============================================

import { Badge } from "@workspace/ui/components/feedback/badge";
import { cn } from "@workspace/ui/lib/utils";

import type { QueryLogEntry } from "@workspace/shared";

import { durationLabel, formatTime } from "@/lib/telescope";

export interface SqlListProps {
	readonly queries: readonly QueryLogEntry[];
	/** Marks the slow-SQL threshold in the header (e.g. "≥500ms"). */
	readonly slowThresholdMs?: number;
}

/** One query card. The <details> toggle needs no JS, so no per-row hooks. */
function QueryCard({ query, slowThresholdMs }: { readonly query: QueryLogEntry; readonly slowThresholdMs: number | undefined }): React.JSX.Element {
	const isSlow: boolean = slowThresholdMs !== undefined && query.durationMs >= slowThresholdMs;

	return (
		<details className="group rounded-lg border bg-card text-card-foreground shadow-xs">
			<summary className="flex cursor-pointer list-none items-center gap-3 p-3 transition-colors hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<Badge variant="outline" className="font-mono">
						{query.model}
					</Badge>
					<span className="font-mono text-xs text-muted-foreground">{query.operation}</span>
				</div>
				<span className={cn("shrink-0 text-xs font-medium tabular-nums", isSlow ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
					{durationLabel(query.durationMs)}
				</span>
				<span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">{formatTime(query.createdAt)}</span>
			</summary>
			<div className="space-y-2 border-t p-3">
				<pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground">{query.query}</pre>
				{query.params !== null ? (
					<div>
						<p className="mb-1 text-[11px] font-medium text-muted-foreground uppercase">Bind params (sanitized)</p>
						<pre className="overflow-x-auto rounded-lg bg-muted/50 p-2 font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">{query.params}</pre>
					</div>
				) : null}
			</div>
		</details>
	);
}

/** SqlList — cards stacked newest-first, slow queries highlighted. */
export function SqlList({ queries, slowThresholdMs = 500 }: SqlListProps): React.JSX.Element {
	if (queries.length === 0) {
		return <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No queries captured for this request.</p>;
	}

	return (
		<div className="space-y-2">
			{queries.map((query) => (
				<QueryCard key={query.id} query={query} slowThresholdMs={slowThresholdMs} />
			))}
		</div>
	);
}
