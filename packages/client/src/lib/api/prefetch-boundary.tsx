import { HydrationBoundary, type DehydratedState } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { PrefetchReport } from "./server-api";

/**
 * Server component that hydrates a `prefetchPage` result into the client
 * query cache and renders the page children. Optionally shows a subtle
 * "degraded data" note when some server-side prefetches failed (opt-in via
 * `showDegradedNote`) — the note is server-rendered, so it's visible in the
 * initial HTML without any client round-trip.
 */
export interface PrefetchBoundaryProps {
	readonly state: DehydratedState;
	readonly report?: PrefetchReport;
	readonly showDegradedNote?: boolean;
	readonly children: ReactNode;
}

export function PrefetchBoundary({ state, report, showDegradedNote = false, children }: PrefetchBoundaryProps): React.JSX.Element {
	const degraded: boolean = showDegradedNote && report !== undefined && report.failed > 0 && report.total > 0;

	const failedCount: string = report === undefined ? "" : String(report.failed);
	const totalCount: string = report === undefined ? "" : String(report.total);

	return (
		<HydrationBoundary state={state}>
			{degraded ? (
				<div className="mb-4 rounded-md border border-yellow-700/50 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-200">
					Some data failed to load server-side ({failedCount} of {totalCount} prefetches) — the affected views are loading live data now.
				</div>
			) : null}
			{children}
		</HydrationBoundary>
	);
}
