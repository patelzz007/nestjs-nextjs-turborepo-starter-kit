"use client";

// ============================================
// components/telescope/leaderboard-panel.tsx
// Feature 12 — slow-endpoint leaderboard. Top-10 slowest routes (by p95)
// over the overview's range, with avg/max/count/error counts.
//
// Dumb component: entries arrive via props; rows link out via href.
// ============================================

import { Trophy } from "lucide-react";
import Link from "next/link";

import type { TelescopeLeaderboardEntry } from "@workspace/shared";

import { durationLabel, durationTone } from "@/lib/telescope";

export function LeaderboardPanel({ entries }: { readonly entries: readonly TelescopeLeaderboardEntry[] }): React.JSX.Element {
	if (entries.length === 0) {
		return (
			<div className="flex min-h-24 items-center justify-center rounded-md border border-dashed p-4 text-center">
				<p className="text-xs text-muted-foreground">No requests captured in this window yet.</p>
			</div>
		);
	}

	return (
		<div className="space-y-1">
			{entries.map((entry, index) => {
				const tone = durationTone(entry.p95Ms);
				return (
					<Link
						key={`${entry.method} ${entry.path}`}
						href={`/telescope/requests?path=${encodeURIComponent(entry.path)}&method=${encodeURIComponent(entry.method)}`}
						className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
						<span className="w-5 shrink-0 text-center font-mono text-xs text-muted-foreground">{String(index + 1)}</span>
						<Trophy className="size-3.5 shrink-0 text-amber-500" />
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">{entry.method}</span>
								<span className="truncate font-mono text-xs text-foreground group-hover:underline">{entry.path}</span>
							</div>
							<div className="mt-0.5 text-[11px] text-muted-foreground">
								{String(entry.count)} req · {String(entry.errorCount)} err
							</div>
						</div>
						<div className="shrink-0 text-right">
							<div className={`font-mono text-xs tabular-nums ${tone.textClass}`}>{durationLabel(entry.p95Ms)}</div>
							<div className="text-[11px] text-muted-foreground">
								avg {durationLabel(entry.avgMs)} · max {durationLabel(entry.maxMs)}
							</div>
						</div>
					</Link>
				);
			})}
		</div>
	);
}
