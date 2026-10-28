// ============================================
// results.ts — turning k6's metric stream into seconds, steps and totals
// ============================================
// k6 writes one JSON line per measurement (`--out json=…`). This aggregator reads them as they
// arrive: each request's duration (`http_req_duration`), whether it failed (`http_req_failed`) and
// the virtual users in flight (`vus`), by second since the run's first measurement and by the
// scenario step each request was tagged with. Memory is bounded: durations are kept in reservoirs.

import { epochMs, latencyPercentiles, Reservoir, type LoadTestPoint, type LoadTestStepStat, type LoadTestTotals } from "@workspace/shared";
import { z } from "zod";

/** Durations kept per second, per step, and for the whole run. */
const SECOND_SAMPLE = 2_000;
const STEP_SAMPLE = 5_000;
const TOTAL_SAMPLE = 50_000;
const MS_PER_SECOND = 1_000;

/** One k6 JSON line, as far as the aggregator reads it. */
const K6PointSchema = z.object({
	type: z.literal("Point"),
	metric: z.string(),
	data: z.object({ time: z.string(), value: z.number(), tags: z.record(z.string(), z.string()).nullable().optional() }),
});

interface SecondBucket {
	readonly durations: Reservoir;
	failures: number;
	virtualUsers: number;
}

interface StepBucket {
	readonly durations: Reservoir;
	failures: number;
}

export class K6ResultsAggregator {
	private _startMs: number | null = null;
	private readonly _seconds = new Map<number, SecondBucket>();
	private readonly _steps = new Map<string, StepBucket>();
	private readonly _total = new Reservoir(TOTAL_SAMPLE);
	private _totalFailures = 0;
	private _emittedUpTo = -1;
	private _currentVus = 0;

	/** Reads one line of k6 output; anything that is not a measurement is ignored. */
	public addLine(line: string): void {
		if (line.trim().length === 0) {
			return;
		}
		let parsed: z.output<typeof K6PointSchema>;
		try {
			const result = K6PointSchema.safeParse(JSON.parse(line));
			if (!result.success) {
				return;
			}
			parsed = result.data;
		} catch {
			return;
		}
		const at: number = Date.parse(parsed.data.time);
		if (Number.isNaN(at)) {
			return;
		}
		this._startMs ??= at;
		const second: number = Math.max(0, Math.floor((at - this._startMs) / MS_PER_SECOND));
		const bucket: SecondBucket = this.secondBucket(second);
		const step: string = parsed.data.tags?.step ?? "request";
		switch (parsed.metric) {
			case "http_req_duration":
				bucket.durations.add(parsed.data.value);
				this.stepBucket(step).durations.add(parsed.data.value);
				this._total.add(parsed.data.value);
				break;
			case "http_req_failed":
				if (parsed.data.value > 0) {
					bucket.failures += 1;
					this.stepBucket(step).failures += 1;
					this._totalFailures += 1;
				}
				break;
			case "vus":
				this._currentVus = parsed.data.value;
				bucket.virtualUsers = parsed.data.value;
				break;
		}
	}

	/**
	 * The seconds finished since the last call (every second before `nowMs`'s, or all of them when
	 * the run has ended), each once.
	 */
	public takeFinishedSeconds(nowMs: number, ended: boolean): LoadTestPoint[] {
		if (this._startMs === null) {
			return [];
		}
		const startMs: number = this._startMs;
		const current: number = Math.floor((nowMs - startMs) / MS_PER_SECOND);
		const last: number = ended ? Math.max(...this._seconds.keys(), this._emittedUpTo) : current - 1;
		const points: LoadTestPoint[] = [];
		for (let second = this._emittedUpTo + 1; second <= last; second += 1) {
			const bucket: SecondBucket | undefined = this._seconds.get(second);
			const { p50, p95, p99 } = latencyPercentiles(bucket?.durations.sample ?? []);
			points.push({
				second,
				at: epochMs(startMs + second * MS_PER_SECOND),
				virtualUsers: bucket?.virtualUsers ?? this._currentVus,
				requests: bucket?.durations.count ?? 0,
				failures: bucket?.failures ?? 0,
				p50Ms: p50,
				p95Ms: p95,
				p99Ms: p99,
			});
			this._seconds.delete(second);
		}
		this._emittedUpTo = Math.max(this._emittedUpTo, last);
		return points;
	}

	/** Every step's totals so far. */
	public stepStats(): LoadTestStepStat[] {
		return [...this._steps].map(([step, bucket]) => {
			const { p50, p95, p99 } = latencyPercentiles(bucket.durations.sample);
			return { step, requests: bucket.durations.count, failures: bucket.failures, p50Ms: p50, p95Ms: p95, p99Ms: p99 };
		});
	}

	/** The whole run's totals; `peakRps` is the busiest second seen. */
	public totals(peakRps: number | null): LoadTestTotals {
		const { p50, p95, p99 } = latencyPercentiles(this._total.sample);
		return { requests: this._total.count, failures: this._totalFailures, p50Ms: p50, p95Ms: p95, p99Ms: p99, peakRps };
	}

	private secondBucket(second: number): SecondBucket {
		const existing: SecondBucket | undefined = this._seconds.get(second);
		if (existing !== undefined) {
			return existing;
		}
		const bucket: SecondBucket = { durations: new Reservoir(SECOND_SAMPLE), failures: 0, virtualUsers: this._currentVus };
		this._seconds.set(second, bucket);
		return bucket;
	}

	private stepBucket(step: string): StepBucket {
		const existing: StepBucket | undefined = this._steps.get(step);
		if (existing !== undefined) {
			return existing;
		}
		const bucket: StepBucket = { durations: new Reservoir(STEP_SAMPLE), failures: 0 };
		this._steps.set(step, bucket);
		return bucket;
	}
}
