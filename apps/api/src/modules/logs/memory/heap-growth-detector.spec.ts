import { describe, expect, it } from "vitest";

import type { MemoryLeakDetectionConfig } from "../../../config/api-config.schema";
import { BYTES_PER_MB, HEAP_FLOOR_BUCKETS_PER_WINDOW, HeapGrowthDetector } from "./heap-growth-detector";

const MS_PER_MINUTE = 60_000;
const STARTED_AT = 1_790_000_000_000;
const CONFIG: MemoryLeakDetectionConfig = { warmupMs: 5 * MS_PER_MINUTE, windowMs: 30 * MS_PER_MINUTE, growthThresholdMb: 64 };
const JUDGED_FROM = STARTED_AT + CONFIG.warmupMs;
/** One post-GC sample every 20 s — a quiet API's major GC cadence is in this range. */
const GC_EVERY_MS = 20_000;

function mb(value: number): number {
	return value * BYTES_PER_MB;
}

/** Feeds `durationMs` of post-GC samples starting at `fromEpochMs`, heap given by `heapAt(elapsedMs)`. */
function feed(detector: HeapGrowthDetector, fromEpochMs: number, durationMs: number, heapAt: (elapsedMs: number) => number): number {
	let at = fromEpochMs;
	for (let elapsed = 0; elapsed <= durationMs; elapsed += GC_EVERY_MS) {
		at = fromEpochMs + elapsed;
		detector.record({ atEpochMs: at, heapUsedBytes: heapAt(elapsed) });
	}
	return at;
}

describe("HeapGrowthDetector", () => {
	it("never judges during warm-up, however much the heap grows (module loading, JIT, caches)", () => {
		const detector = new HeapGrowthDetector(CONFIG, STARTED_AT);
		const last = feed(detector, STARTED_AT, CONFIG.warmupMs - GC_EVERY_MS, (elapsed: number): number => mb(100 + elapsed / 1_000));

		expect(detector.assess(last)).toEqual({ status: "warming_up", judgedFromEpochMs: JUDGED_FROM });
		expect(detector.bucketCount()).toBe(0);
	});

	it("needs the window covered before it judges a trend", () => {
		const detector = new HeapGrowthDetector(CONFIG, STARTED_AT);
		const last = feed(detector, JUDGED_FROM, 10 * MS_PER_MINUTE, (elapsed: number): number => mb(130 + elapsed / 1_000));

		expect(detector.assess(last)).toMatchObject({ status: "insufficient_data" });
	});

	it("reports a stable heap for the measured idle API: flat post-GC floor around 130 MB", () => {
		const detector = new HeapGrowthDetector(CONFIG, STARTED_AT);
		const last = feed(detector, JUDGED_FROM, CONFIG.windowMs, (elapsed: number): number => mb(129.4 + ((elapsed / GC_EVERY_MS) % 3) * 0.3));

		expect(detector.assess(last)).toMatchObject({ status: "stable" });
	});

	it("does not mistake a bounded cache filling up once for a leak", () => {
		const detector = new HeapGrowthDetector(CONFIG, STARTED_AT);
		// +80 MB in the first 5 judged minutes (e.g. 256 preparsed policy slots), flat afterwards.
		const last = feed(detector, JUDGED_FROM, 2 * CONFIG.windowMs, (elapsed: number): number => mb(130 + (Math.min(elapsed, 5 * MS_PER_MINUTE) / (5 * MS_PER_MINUTE)) * 80));

		expect(detector.assess(last)).toMatchObject({ status: "stable" });
	});

	it("does not let a short spike (a large request in flight during a GC) become the floor", () => {
		const detector = new HeapGrowthDetector(CONFIG, STARTED_AT);
		const last = feed(detector, JUDGED_FROM, CONFIG.windowMs, (elapsed: number): number => mb(elapsed > 25 * MS_PER_MINUTE && elapsed < 26 * MS_PER_MINUTE ? 400 : 130));

		expect(detector.assess(last)).toMatchObject({ status: "stable" });
	});

	it("flags a post-GC floor that keeps rising past the threshold across the window", () => {
		const detector = new HeapGrowthDetector(CONFIG, STARTED_AT);
		// 6 MB per minute of retained memory: the later half's floor sits ~90 MB above the earlier half's.
		const last = feed(detector, JUDGED_FROM, CONFIG.windowMs, (elapsed: number): number => mb(130 + (elapsed / MS_PER_MINUTE) * 6));

		const assessment = detector.assess(last);

		expect(assessment.status).toBe("suspected_leak");
		if (assessment.status === "suspected_leak") {
			// The window's oldest slice may already be evicted, so the early floor is "about 130 MB".
			expect(assessment.earlyFloorBytes).toBeLessThan(mb(135));
			expect(assessment.growthBytes).toBeGreaterThanOrEqual(mb(CONFIG.growthThresholdMb));
		}
	});

	it("keeps memory bounded: at most one bucket per window slice, however often the GC runs", () => {
		const detector = new HeapGrowthDetector(CONFIG, STARTED_AT);
		for (let at = JUDGED_FROM; at < JUDGED_FROM + 3 * CONFIG.windowMs; at += 100) {
			detector.record({ atEpochMs: at, heapUsedBytes: mb(130) });
		}

		expect(detector.bucketCount()).toBeLessThanOrEqual(HEAP_FLOOR_BUCKETS_PER_WINDOW + 1);
	});

	it("forgets samples older than the window", () => {
		const detector = new HeapGrowthDetector(CONFIG, STARTED_AT);
		const leakEnd = feed(detector, JUDGED_FROM, CONFIG.windowMs, (elapsed: number): number => mb(130 + (elapsed / MS_PER_MINUTE) * 6));
		// The leak was fixed (e.g. hot reload of a config): flat at the new level for a whole window.
		const last = feed(detector, leakEnd + GC_EVERY_MS, CONFIG.windowMs, (): number => mb(250));

		expect(detector.assess(last)).toMatchObject({ status: "stable" });
	});
});
