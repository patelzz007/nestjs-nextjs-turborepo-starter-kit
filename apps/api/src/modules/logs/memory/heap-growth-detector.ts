import type { MemoryLeakDetectionConfig } from "../../../config/api-config.schema";

/** Bytes in one MiB — thresholds are configured in MB, heap sizes are measured in bytes. */
export const BYTES_PER_MB = 1024 * 1024;

/**
 * The window is split into this many buckets; each keeps only the LOWEST
 * post-GC heap seen in it. Memory stays bounded however often the GC runs,
 * and a short-lived spike (a large request in flight during a GC) never
 * becomes the floor.
 */
export const HEAP_FLOOR_BUCKETS_PER_WINDOW = 60;

/** Below this many buckets with a sample, the window says nothing reliable about a trend. */
export const MIN_HEAP_FLOOR_BUCKETS = 6;

/** The samples must span at least this share of the window before a trend is judged. */
export const MIN_WINDOW_COVERAGE_RATIO = 0.8;

/** Heap in use right after a major (mark-compact) GC — the live set, without collectable garbage. */
export interface HeapSample {
	readonly atEpochMs: number;
	readonly heapUsedBytes: number;
}

/** Outcome of {@link HeapGrowthDetector.assess}. */
export type HeapGrowthAssessment =
	| { readonly status: "warming_up"; readonly judgedFromEpochMs: number }
	| { readonly status: "insufficient_data"; readonly buckets: number; readonly coveredMs: number }
	| {
			readonly status: "stable" | "suspected_leak";
			readonly earlyFloorBytes: number;
			readonly lateFloorBytes: number;
			readonly growthBytes: number;
			readonly coveredMs: number;
	  };

interface HeapFloorBucket {
	readonly index: number;
	readonly startEpochMs: number;
	floorBytes: number;
}

/**
 * Decides whether the post-GC heap keeps growing — the signature of a leak —
 * as opposed to garbage waiting for the next GC, warm-up, or a bounded cache
 * filling up once.
 *
 * Rules:
 * - samples before `startedAt + warmupMs` are ignored;
 * - only the last `windowMs` is judged, and only once it is covered;
 * - the floor (minimum) of the later half of the window is compared with the
 *   floor of the earlier half: a leak raises even the lowest post-GC heap,
 *   a bounded cache stops rising once full, and garbage never shows up in
 *   a post-GC sample at all.
 */
export class HeapGrowthDetector {
	private readonly buckets: HeapFloorBucket[] = [];
	private readonly bucketMs: number;
	private readonly growthThresholdBytes: number;
	private readonly judgedFromEpochMs: number;

	public constructor(
		private readonly config: MemoryLeakDetectionConfig,
		startedAtEpochMs: number,
	) {
		this.bucketMs = config.windowMs / HEAP_FLOOR_BUCKETS_PER_WINDOW;
		this.growthThresholdBytes = config.growthThresholdMb * BYTES_PER_MB;
		this.judgedFromEpochMs = startedAtEpochMs + config.warmupMs;
	}

	public record(sample: HeapSample): void {
		if (sample.atEpochMs < this.judgedFromEpochMs) {
			return;
		}
		const index = Math.floor(sample.atEpochMs / this.bucketMs);
		const last = this.buckets.at(-1);
		if (last?.index === index) {
			last.floorBytes = Math.min(last.floorBytes, sample.heapUsedBytes);
		} else {
			this.buckets.push({ index, startEpochMs: index * this.bucketMs, floorBytes: sample.heapUsedBytes });
		}
		this.evictBefore(sample.atEpochMs - this.config.windowMs);
	}

	/** Buckets currently held (bounded by {@link HEAP_FLOOR_BUCKETS_PER_WINDOW} + 1). */
	public bucketCount(): number {
		return this.buckets.length;
	}

	public assess(nowEpochMs: number): HeapGrowthAssessment {
		if (nowEpochMs < this.judgedFromEpochMs) {
			return { status: "warming_up", judgedFromEpochMs: this.judgedFromEpochMs };
		}
		this.evictBefore(nowEpochMs - this.config.windowMs);
		const first = this.buckets.at(0);
		const last = this.buckets.at(-1);
		const coveredMs = first === undefined || last === undefined ? 0 : last.startEpochMs + this.bucketMs - first.startEpochMs;
		if (first === undefined || this.buckets.length < MIN_HEAP_FLOOR_BUCKETS || coveredMs < this.config.windowMs * MIN_WINDOW_COVERAGE_RATIO) {
			return { status: "insufficient_data", buckets: this.buckets.length, coveredMs };
		}
		const midpointEpochMs = first.startEpochMs + coveredMs / 2;
		const earlyFloorBytes = floorOf(this.buckets.filter((bucket: HeapFloorBucket): boolean => bucket.startEpochMs < midpointEpochMs));
		const lateFloorBytes = floorOf(this.buckets.filter((bucket: HeapFloorBucket): boolean => bucket.startEpochMs >= midpointEpochMs));
		const growthBytes = lateFloorBytes - earlyFloorBytes;
		return {
			status: growthBytes >= this.growthThresholdBytes ? "suspected_leak" : "stable",
			earlyFloorBytes,
			lateFloorBytes,
			growthBytes,
			coveredMs,
		};
	}

	private evictBefore(cutoffEpochMs: number): void {
		let head = this.buckets.at(0);
		while (head !== undefined && head.startEpochMs < cutoffEpochMs) {
			this.buckets.shift();
			head = this.buckets.at(0);
		}
	}
}

function floorOf(buckets: readonly HeapFloorBucket[]): number {
	return Math.min(...buckets.map((bucket: HeapFloorBucket): number => bucket.floorBytes));
}
