// ============================================
// domain/policies/metric-rollup.policy.ts — folding history points into one coarser point
// ============================================
// Design patterns:
//   - STRATEGY: each figure names how its values combine (average, peak, total, latest), so ONE
//     generic `rollUp` serves servers, instances and dependencies alike (Open/Closed: a new point
//     type writes its own builder; the algorithm does not change).
//   - Pure functions (no I/O).

import type { EpochMs, OpsDependencyPoint, OpsInstancePoint, OpsServerPoint } from "@workspace/shared";

/** How one figure combines across the points of a bucket. */
export type RollupStrategy = "avg" | "max" | "sum" | "last";

/** Reads one figure of every point and combines it. */
export interface RollupPicker<Point> {
	/** A figure every point has. */
	readonly required: (strategy: RollupStrategy, read: (point: Point) => number) => number;
	/**
	 * A figure some points may lack (not measured on that platform, or in that bucket). Only measured
	 * values count, so one missing sample never drags an average to zero; `null` when no point has it.
	 */
	readonly optional: (strategy: RollupStrategy, read: (point: Point) => number | null) => number | null;
}

function combine(values: readonly number[], strategy: RollupStrategy): number {
	switch (strategy) {
		case "avg":
			return values.reduce((total, value) => total + value, 0) / values.length;
		case "max":
			return values.reduce((peak, value) => Math.max(peak, value), Number.NEGATIVE_INFINITY);
		case "sum":
			return values.reduce((total, value) => total + value, 0);
		case "last":
			return values.at(-1) ?? 0;
	}
}

/**
 * One point summarising `points` (oldest first), built by `build` from a {@link RollupPicker}; `null`
 * for no points.
 */
export function rollUp<Point, Result>(points: readonly Point[], build: (pick: RollupPicker<Point>) => Result): Result | null {
	if (points.length === 0) {
		return null;
	}
	return build({
		required: (strategy, read) => combine(points.map(read), strategy),
		optional: (strategy, read) => {
			const values: number[] = points.flatMap((point) => {
				const value: number | null = read(point);
				return value === null ? [] : [value];
			});
			return values.length === 0 ? null : combine(values, strategy);
		},
	});
}

// ── The three point types' rollups ──────────────────────────────────────────

/** A server's minutes as one bucket starting at `bucketStart`: averages of rates and usage, peaks of peaks. */
export function rollUpServerPoints(points: readonly OpsServerPoint[], bucketStart: EpochMs): OpsServerPoint | null {
	return rollUp(points, (pick) => ({
		bucketStart,
		cpuPercentAvg: pick.required("avg", (point) => point.cpuPercentAvg),
		cpuPercentMax: pick.required("max", (point) => point.cpuPercentMax),
		stealPercentAvg: pick.optional("avg", (point) => point.stealPercentAvg),
		iowaitPercentAvg: pick.optional("avg", (point) => point.iowaitPercentAvg),
		load1Avg: pick.required("avg", (point) => point.load1Avg),
		memoryUsedBytes: Math.round(pick.required("avg", (point) => point.memoryUsedBytes)),
		memoryTotalBytes: pick.required("last", (point) => point.memoryTotalBytes),
		memoryPercentMax: pick.required("max", (point) => point.memoryPercentMax),
		swapUsedBytes: Math.round(pick.required("avg", (point) => point.swapUsedBytes)),
		diskUsedBytes: pick.required("last", (point) => point.diskUsedBytes),
		diskTotalBytes: pick.required("last", (point) => point.diskTotalBytes),
		diskPercentMax: pick.required("max", (point) => point.diskPercentMax),
		inodesPercentMax: pick.optional("max", (point) => point.inodesPercentMax),
		diskReadBytesPerSec: pick.required("avg", (point) => point.diskReadBytesPerSec),
		diskWriteBytesPerSec: pick.required("avg", (point) => point.diskWriteBytesPerSec),
		netRxBytesPerSec: pick.required("avg", (point) => point.netRxBytesPerSec),
		netTxBytesPerSec: pick.required("avg", (point) => point.netTxBytesPerSec),
		tcpConnections: Math.round(pick.required("avg", (point) => point.tcpConnections)),
		processCount: Math.round(pick.required("avg", (point) => point.processCount)),
	}));
}

/**
 * An instance's minutes as one bucket. Request counts add up; latency percentiles cannot be combined
 * exactly from percentiles, so the bucket keeps the worst minute's (an upper bound, never an
 * understatement).
 */
export function rollUpInstancePoints(points: readonly OpsInstancePoint[], bucketStart: EpochMs): OpsInstancePoint | null {
	return rollUp(points, (pick) => ({
		bucketStart,
		cpuPercentAvg: pick.required("avg", (point) => point.cpuPercentAvg),
		cpuPercentMax: pick.required("max", (point) => point.cpuPercentMax),
		rssBytes: Math.round(pick.required("max", (point) => point.rssBytes)),
		heapUsedBytes: Math.round(pick.required("max", (point) => point.heapUsedBytes)),
		eventLoopLagP99Ms: pick.required("max", (point) => point.eventLoopLagP99Ms),
		gcPauseMs: pick.required("sum", (point) => point.gcPauseMs),
		requestCount: pick.required("sum", (point) => point.requestCount),
		serverErrorCount: pick.required("sum", (point) => point.serverErrorCount),
		clientErrorCount: pick.required("sum", (point) => point.clientErrorCount),
		latencyP50Ms: pick.optional("max", (point) => point.latencyP50Ms),
		latencyP95Ms: pick.optional("max", (point) => point.latencyP95Ms),
		latencyP99Ms: pick.optional("max", (point) => point.latencyP99Ms),
	}));
}

/** A dependency's minutes as one bucket. */
export function rollUpDependencyPoints(points: readonly OpsDependencyPoint[], bucketStart: EpochMs): OpsDependencyPoint | null {
	const roundedOrNull = (value: number | null): number | null => (value === null ? null : Math.round(value));
	return rollUp(points, (pick) => ({
		bucketStart,
		upPercent: pick.required("avg", (point) => point.upPercent),
		latencyMsAvg: pick.optional("avg", (point) => point.latencyMsAvg),
		connectionsUsed: roundedOrNull(pick.optional("max", (point) => point.connectionsUsed)),
		sizeBytes: pick.optional("last", (point) => point.sizeBytes),
		memoryUsedBytes: pick.optional("max", (point) => point.memoryUsedBytes),
		backlog: pick.optional("max", (point) => point.backlog),
		failed: pick.optional("last", (point) => point.failed),
	}));
}
