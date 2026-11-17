// How many test files finish each second, for the dashboard's activity sparkline. Pure: the dashboard feeds it the
// running total and the time on every frame.

export interface Throughput {
	/** Files finished in each of the latest whole seconds, oldest first. */
	readonly perSecond: readonly number[];
	/** When the current second began. */
	readonly sampledAtMs: number;
	/** The running total when it began. */
	readonly filesAtSample: number;
}

/** The sparkline's length. */
export const SECONDS_KEPT = 20;
const SAMPLE_MS = 1000;

export function startThroughput(nowMs: number): Throughput {
	return { perSecond: [], sampledAtMs: nowMs, filesAtSample: 0 };
}

/**
 * Closes every whole second since the last one. A busy event loop can miss a second: what finished meanwhile goes to the
 * latest, and the missed ones count none.
 */
export function sampleThroughput(current: Throughput, files: number, nowMs: number): Throughput {
	const seconds = Math.floor((nowMs - current.sampledAtMs) / SAMPLE_MS);
	if (seconds < 1) {
		return current;
	}
	const missed = Array.from({ length: seconds - 1 }, () => 0);
	return {
		perSecond: [...current.perSecond, ...missed, files - current.filesAtSample].slice(-SECONDS_KEPT),
		sampledAtMs: current.sampledAtMs + seconds * SAMPLE_MS,
		filesAtSample: files,
	};
}
