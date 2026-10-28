// ============================================
// domain/policies/history-window.policy.ts — which buckets a history range covers
// ============================================
// Pure functions (no I/O): the same range always yields the same window for the same clock.

import { epochMs, OPS_HISTORY_RANGES, OPS_HOUR_MS, OPS_MINUTE_MS, type EpochMs, type OpsHistoryRange, type OpsResolution } from "@workspace/shared";

/** The buckets one history answer covers: `[from, to]`, both bucket starts, at one resolution. */
export interface HistoryWindow {
	readonly range: OpsHistoryRange;
	readonly resolution: OpsResolution;
	readonly from: EpochMs;
	readonly to: EpochMs;
}

/** The length of one bucket of a resolution. */
export function bucketMs(resolution: OpsResolution): number {
	return resolution === "MINUTE" ? OPS_MINUTE_MS : OPS_HOUR_MS;
}

/** The start of the bucket `at` falls in. */
export function bucketStartOf(at: number, resolution: OpsResolution): EpochMs {
	const size: number = bucketMs(resolution);
	return epochMs(Math.floor(at / size) * size);
}

/**
 * The window a range shows at `now`: its resolution from {@link OPS_HISTORY_RANGES}, ending with the
 * bucket `now` is in (still filling) and starting one span earlier.
 */
export function historyWindow(range: OpsHistoryRange, now: EpochMs): HistoryWindow {
	const { spanMs, resolution } = OPS_HISTORY_RANGES[range];
	const to: EpochMs = bucketStartOf(now, resolution);
	return { range, resolution, from: epochMs(Math.max(0, to - spanMs)), to };
}
