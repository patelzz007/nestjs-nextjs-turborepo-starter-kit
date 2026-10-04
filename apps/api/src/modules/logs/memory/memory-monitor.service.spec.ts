import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { BYTES_PER_MB, type HeapSample } from "./heap-growth-detector";
import { MemoryMonitorService } from "./memory-monitor.service";
import type { PostGcHeapProbe } from "./post-gc-heap-probe";

const MS_PER_MINUTE = 60_000;
const STARTED_AT = 1_790_000_000_000;
const WARMUP_MS = 5 * MS_PER_MINUTE;
const WINDOW_MS = 10 * MS_PER_MINUTE;
const GC_EVERY_MS = 10_000;

/** Test double: the test decides when a "major GC" happens and what the heap is. */
class ManualHeapProbe implements PostGcHeapProbe {
	public listener: ((sample: HeapSample) => void) | null = null;
	public stops = 0;
	public now: number = STARTED_AT;

	public start(onSample: (sample: HeapSample) => void): () => void {
		this.listener = onSample;
		return (): void => {
			this.stops += 1;
			this.listener = null;
		};
	}

	public nowEpochMs(): number {
		return this.now;
	}

	/** One post-GC sample every GC_EVERY_MS for `durationMs`, heap given by `heapMbAt(elapsedMs)`. */
	public gcFor(durationMs: number, heapMbAt: (elapsedMs: number) => number): void {
		const from = this.now;
		for (let elapsed = 0; elapsed <= durationMs; elapsed += GC_EVERY_MS) {
			this.now = from + elapsed;
			this.listener?.({ atEpochMs: this.now, heapUsedBytes: heapMbAt(elapsed) * BYTES_PER_MB });
		}
	}
}

function monitor(probe: ManualHeapProbe, memoryMonitoring: "true" | "false" = "true"): MemoryMonitorService {
	const config = createTestTypedConfig({
		MEMORY_MONITORING: memoryMonitoring,
		MEMORY_LEAK_WARMUP_MS: String(WARMUP_MS),
		MEMORY_LEAK_WINDOW_MS: String(WINDOW_MS),
		MEMORY_LEAK_GROWTH_THRESHOLD_MB: "32",
	});
	return new MemoryMonitorService(config, probe);
}

function leakWarnings(warn: MockInstance<Logger["warn"]>): string[] {
	return warn.mock.calls.map((call): string => String(call[0])).filter((line: string): boolean => line.includes("memory.leak_suspected"));
}

describe("MemoryMonitorService", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("stays off unless MEMORY_MONITORING is on (always on in production)", () => {
		const probe = new ManualHeapProbe();
		const service = monitor(probe, "false");

		service.onModuleInit();

		expect(service.isRunning()).toBe(false);
		expect(probe.listener).toBeNull();
	});

	it("does NOT warn for the reported symptom: heapUsed between GCs rising ~1 MB / 5 s from a boot-time baseline", () => {
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
		const probe = new ManualHeapProbe();
		const service = monitor(probe);
		service.onModuleInit();

		// Post-GC heap is what the monitor sees: flat ~130 MB, however high raw heapUsed climbs in between.
		probe.gcFor(3 * WINDOW_MS, (elapsed: number): number => 130 + ((elapsed / GC_EVERY_MS) % 2) * 0.5);

		expect(leakWarnings(warn)).toEqual([]);
		service.onModuleDestroy();
	});

	it("warns ONCE per window while the post-GC floor keeps rising past the threshold, with the evidence", () => {
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
		vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
		const probe = new ManualHeapProbe();
		const service = monitor(probe);
		service.onModuleInit();

		probe.gcFor(WARMUP_MS, (): number => 130);
		// 8 MB/min retained after warm-up, for two windows.
		probe.gcFor(2 * WINDOW_MS, (elapsed: number): number => 130 + (elapsed / MS_PER_MINUTE) * 8);

		const warnings = leakWarnings(warn);
		expect(warnings).toHaveLength(2);
		expect(JSON.parse(warnings[0] ?? "{}")).toMatchObject({ event: "memory.leak_suspected", thresholdMb: 32, windowMs: WINDOW_MS });
		service.onModuleDestroy();
	});

	it("stops observing GCs on shutdown", () => {
		vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
		const probe = new ManualHeapProbe();
		const service = monitor(probe);
		service.onModuleInit();

		service.onModuleDestroy();

		expect(probe.stops).toBe(1);
		expect(service.isRunning()).toBe(false);
	});
});
