// ============================================
// infrastructure/instance/process-metrics.sampler.ts — this Node process's own health
// ============================================
// CPU from `process.cpuUsage` deltas, memory from `process.memoryUsage`, event-loop lag from
// `perf_hooks.monitorEventLoopDelay`, garbage-collection pauses from a `gc` PerformanceObserver.
// Each `sample()` covers the time since the previous one.

import { monitorEventLoopDelay, PerformanceObserver } from "node:perf_hooks";

const MICROSECONDS_PER_MILLISECOND = 1_000;
const NANOSECONDS_PER_MILLISECOND = 1_000_000;
const HUNDRED = 100;
/** The event-loop histogram's resolution. */
const EVENT_LOOP_RESOLUTION_MS = 20;
const P99 = 99;

/** One sample of the process. */
export interface ProcessSample {
	/** CPU time used over wall time since the previous sample, in percent of one core (can exceed 100). */
	readonly cpuPercent: number;
	readonly rssBytes: number;
	readonly heapUsedBytes: number;
	readonly heapTotalBytes: number;
	readonly eventLoopLagP99Ms: number;
	/** Milliseconds spent in garbage collection since the previous sample. */
	readonly gcPauseMs: number;
	readonly activeHandles: number;
}

export class ProcessMetricsSampler {
	private readonly loop: ReturnType<typeof monitorEventLoopDelay> = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
	private readonly gc: PerformanceObserver;
	private gcMs = 0;
	private lastCpu: NodeJS.CpuUsage = process.cpuUsage();
	private lastAt: number;

	public constructor(private readonly now: () => number = Date.now) {
		this.lastAt = now();
		this.gc = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				this.gcMs += entry.duration;
			}
		});
	}

	public start(): void {
		this.loop.enable();
		this.gc.observe({ entryTypes: ["gc"] });
	}

	public stop(): void {
		this.loop.disable();
		this.gc.disconnect();
	}

	public sample(): ProcessSample {
		const at: number = this.now();
		const cpu: NodeJS.CpuUsage = process.cpuUsage(this.lastCpu);
		const wallMs: number = Math.max(1, at - this.lastAt);
		const cpuMs: number = (cpu.user + cpu.system) / MICROSECONDS_PER_MILLISECOND;
		const memory: NodeJS.MemoryUsage = process.memoryUsage();
		const sample: ProcessSample = {
			cpuPercent: (cpuMs / wallMs) * HUNDRED,
			rssBytes: memory.rss,
			heapUsedBytes: memory.heapUsed,
			heapTotalBytes: memory.heapTotal,
			eventLoopLagP99Ms: this.loop.percentile(P99) / NANOSECONDS_PER_MILLISECOND,
			gcPauseMs: this.gcMs,
			activeHandles: process.getActiveResourcesInfo().length,
		};
		this.lastCpu = process.cpuUsage();
		this.lastAt = at;
		this.gcMs = 0;
		this.loop.reset();
		return sample;
	}
}
