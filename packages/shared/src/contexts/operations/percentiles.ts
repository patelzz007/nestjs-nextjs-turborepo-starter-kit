// Percentiles and a bounded sample, shared by the API's request metrics and the load runner (ADR 068).

/** The value below which `fraction` (0–1) of `sorted` (ascending) falls — nearest-rank; `null` for no values. */
export function percentileOf(sorted: readonly number[], fraction: number): number | null {
	if (sorted.length === 0) {
		return null;
	}
	const rank: number = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
	return sorted.at(rank) ?? null;
}

/** p50, p95 and p99 of `values` (any order). */
export function latencyPercentiles(values: readonly number[]): { readonly p50: number | null; readonly p95: number | null; readonly p99: number | null } {
	const sorted: number[] = [...values].sort((left, right) => left - right);
	const median = 0.5;
	const p95 = 0.95;
	const p99 = 0.99;
	return { p50: percentileOf(sorted, median), p95: percentileOf(sorted, p95), p99: percentileOf(sorted, p99) };
}

/**
 * A uniform random sample of at most `capacity` values from a stream of any length (reservoir
 * sampling, algorithm R): memory stays bounded under any load, and the percentiles stay unbiased.
 */
export class Reservoir {
	private readonly _values: number[] = [];
	private _seen = 0;

	public constructor(
		private readonly _capacity: number,
		private readonly _random: () => number = Math.random,
	) {}

	public add(value: number): void {
		this._seen += 1;
		if (this._values.length < this._capacity) {
			this._values.push(value);
			return;
		}
		const slot: number = Math.floor(this._random() * this._seen);
		if (slot < this._capacity) {
			this._values[slot] = value;
		}
	}

	/** Every value added so far, sampled. */
	public get sample(): readonly number[] {
		return this._values;
	}

	/** How many values were added (not just kept). */
	public get count(): number {
		return this._seen;
	}
}
