/**
 * Timer maths behind `pnpm tools dev:timing` (plan §19.1): elapsed time between two
 * clock readings, the median of repeated runs, and the per-measurement summary
 * across runs. Pure functions, so they are unit-tested without a clock.
 */

/** Divisor that finds the middle of a sorted list. */
const HALVES = 2;

/** Whole milliseconds from `startMs` to `endMs`. */

export function elapsedMs(startMs: number, endMs: number): number {
	if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
		throw new Error("elapsedMs needs two finite clock readings");
	}
	if (endMs < startMs) {
		throw new Error(`elapsedMs: end (${String(endMs)}) is before start (${String(startMs)})`);
	}
	return Math.round(endMs - startMs);
}

/**
 * The median of `values`, rounded to whole milliseconds; `undefined` for an
 * empty list. An even count takes the mean of the two middle values.
 */

export function median(values: readonly number[]): number | undefined {
	if (values.length === 0) {
		return undefined;
	}
	const sorted = [...values].sort((left, right) => left - right);
	const upperMiddle = Math.floor(sorted.length / HALVES);
	const upper = sorted.at(upperMiddle) ?? Number.NaN;
	if (sorted.length % HALVES === 1) {
		return Math.round(upper);
	}
	const lower = sorted.at(upperMiddle - 1) ?? Number.NaN;
	return Math.round((lower + upper) / HALVES);
}

export interface Measurement {
	phase: string;
	target: string;
	ms: number;
	detail?: string;
}
export interface MeasurementSummary {
	phase: string;
	target: string;
	medianMs: number;
	runs: number;
}

/**
 * The median of every (phase, target) pair across runs, in first-seen order.
 * A run that failed to measure a pair simply has no entry for it; `runs`
 * says how many runs contributed.
 */

export function summarizeRuns(runs: readonly (readonly Measurement[])[]): MeasurementSummary[] {
	const byKey = new Map<string, { phase: string; target: string; values: number[] }>();
	for (const measurements of runs) {
		for (const { phase, target, ms } of measurements) {
			const key = `${phase}\u0000${target}`;
			const entry = byKey.get(key) ?? { phase, target, values: [] };
			entry.values.push(ms);
			byKey.set(key, entry);
		}
	}
	return [...byKey.values()].map(({ phase, target, values }) => ({ phase, target, medianMs: median(values) ?? Number.NaN, runs: values.length }));
}
