import { constants, PerformanceObserver, type PerformanceEntry, type PerformanceObserverEntryList } from "node:perf_hooks";

import { z } from "zod";

import type { HeapSample } from "./heap-growth-detector";

/** DI token of the {@link PostGcHeapProbe} the memory monitor reads. */
export const POST_GC_HEAP_PROBE = Symbol("POST_GC_HEAP_PROBE");

/** Source of heap samples taken right after a major GC, and of the time they are stamped with. */
export interface PostGcHeapProbe {
	/** Delivers one sample after every major GC until the returned function is called. */
	start(onSample: (sample: HeapSample) => void): () => void;
	nowEpochMs(): number;
}

/** The part of a `gc` performance entry the probe reads (`detail` is untyped in @types/node). */
const GcEntrySchema = z.object({ detail: z.object({ kind: z.number().int() }) });

function isMajorGc(entry: PerformanceEntry): boolean {
	const gc = GcEntrySchema.safeParse(entry);
	return gc.success && gc.data.detail.kind === constants.NODE_PERFORMANCE_GC_MAJOR;
}

/**
 * Node implementation: a `gc` PerformanceObserver. After a major
 * (mark-compact) collection `heapUsed` is the live set — garbage that merely
 * waits for the next GC is not in it — so these samples are what a leak
 * check must look at. Minor (scavenge) GCs are ignored: they leave old-space
 * garbage in place. Costs nothing between GCs (no polling timer).
 */
export class NodePostGcHeapProbe implements PostGcHeapProbe {
	public start(onSample: (sample: HeapSample) => void): () => void {
		const observer = new PerformanceObserver((list: PerformanceObserverEntryList): void => {
			if (list.getEntries().some(isMajorGc)) {
				onSample({ atEpochMs: this.nowEpochMs(), heapUsedBytes: process.memoryUsage().heapUsed });
			}
		});
		observer.observe({ entryTypes: ["gc"] });
		return (): void => {
			observer.disconnect();
		};
	}

	public nowEpochMs(): number {
		return Date.now();
	}
}
