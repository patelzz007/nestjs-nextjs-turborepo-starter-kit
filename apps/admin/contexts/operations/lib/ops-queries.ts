// How the operations console caches with TanStack Query: one place, so every screen reuses what
// another already fetched instead of asking again.
//   - Live data (the overview, a server) is fresh for one agent interval and refetched on that pace.
//   - History is fresh for one bucket of its resolution, and keeps the previous range on screen while
//     the next loads (no blank chart when switching 1h → 24h).

import { keepPreviousData } from "@tanstack/react-query";
import { OPS_HISTORY_RANGES, OPS_HOUR_MS, OPS_MINUTE_MS, OPS_SAMPLE_INTERVAL_MS, type OpsHistoryRange } from "@workspace/shared";

export interface OpsLiveQueryOptions {
	readonly staleTime: number;
	readonly refetchInterval: number;
}

/** Live figures: refreshed with every agent report. */
export const OPS_LIVE_QUERY: OpsLiveQueryOptions = { staleTime: OPS_SAMPLE_INTERVAL_MS, refetchInterval: OPS_SAMPLE_INTERVAL_MS };

/** How often a list that changes only when someone acts is refetched (mutations invalidate it at once). */
const LIST_REFRESH_MS = 30_000;

/** Lists that change only when someone acts (alerts, backups, runs). */
export const OPS_LIST_QUERY: OpsLiveQueryOptions = { staleTime: LIST_REFRESH_MS, refetchInterval: LIST_REFRESH_MS };

export interface OpsHistoryQueryOptions {
	readonly staleTime: number;
	readonly refetchInterval: number;
	readonly placeholderData: typeof keepPreviousData;
}

/** A history chart's caching: one bucket of its range's resolution. */
export function opsHistoryQuery(range: OpsHistoryRange): OpsHistoryQueryOptions {
	const bucket: number = OPS_HISTORY_RANGES[range].resolution === "MINUTE" ? OPS_MINUTE_MS : OPS_HOUR_MS;
	return { staleTime: bucket, refetchInterval: bucket, placeholderData: keepPreviousData };
}
