import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import { BYTES_PER_MB, HeapGrowthDetector, type HeapGrowthAssessment, type HeapSample } from "./heap-growth-detector";
import { POST_GC_HEAP_PROBE, type PostGcHeapProbe } from "./post-gc-heap-probe";

/** Rounds bytes to MB with one decimal, for log fields. */
function toMb(bytes: number): number {
	return Math.round((bytes / BYTES_PER_MB) * 10) / 10;
}

/**
 * Leak detection on the heap measured right after each major GC
 * (`MEMORY_MONITORING`, always on in production).
 *
 * Raw `heapUsed` between collections rises steadily on an idle process —
 * that is garbage waiting for the next major GC, not a leak — so it is never
 * compared against a start-up baseline. {@link HeapGrowthDetector} judges the
 * post-GC floor over a sliding window after a warm-up; this service feeds it
 * and logs ONE structured warning per window while a leak is suspected.
 */
@Injectable()
export class MemoryMonitorService implements OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(MemoryMonitorService.name);
	private stopProbe: (() => void) | null = null;
	private lastWarningAtEpochMs: number | null = null;

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(POST_GC_HEAP_PROBE) private readonly probe: PostGcHeapProbe,
	) {}

	public isRunning(): boolean {
		return this.stopProbe !== null;
	}

	public onModuleInit(): void {
		if (!this.config.memoryMonitoring || this.stopProbe !== null) {
			return;
		}
		const thresholds = this.config.memoryLeakDetection;
		const detector = new HeapGrowthDetector(thresholds, this.probe.nowEpochMs());
		this.stopProbe = this.probe.start((sample: HeapSample): void => {
			detector.record(sample);
			this.report(detector.assess(sample.atEpochMs), sample.atEpochMs);
		});
		this.logger.log(JSON.stringify({ event: "memory.monitor_started", ...thresholds }));
	}

	public onModuleDestroy(): void {
		this.stopProbe?.();
		this.stopProbe = null;
	}

	private report(assessment: HeapGrowthAssessment, nowEpochMs: number): void {
		if (assessment.status !== "suspected_leak") {
			return;
		}
		const windowMs = this.config.memoryLeakDetection.windowMs;
		if (this.lastWarningAtEpochMs !== null && nowEpochMs - this.lastWarningAtEpochMs < windowMs) {
			return;
		}
		this.lastWarningAtEpochMs = nowEpochMs;
		this.logger.warn(
			JSON.stringify({
				event: "memory.leak_suspected",
				earlyFloorMb: toMb(assessment.earlyFloorBytes),
				lateFloorMb: toMb(assessment.lateFloorBytes),
				growthMb: toMb(assessment.growthBytes),
				thresholdMb: this.config.memoryLeakDetection.growthThresholdMb,
				windowMs,
				coveredMs: assessment.coveredMs,
			}),
		);
	}
}
