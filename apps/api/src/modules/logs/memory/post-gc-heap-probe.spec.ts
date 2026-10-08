import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import type { HeapSample } from "./heap-growth-detector";
import { NodePostGcHeapProbe } from "./post-gc-heap-probe";

/** Upper bound for the allocation churn below to provoke a major GC. */
const MAJOR_GC_TIMEOUT_MS = 20_000;
const CHURN_BATCH = 200_000;

/** Allocates short-lived strings (plus a little retained data) until `done()` or the timeout. */
async function churnUntil(done: () => boolean): Promise<void> {
	const retained: string[][] = [];
	const deadline = Date.now() + MAJOR_GC_TIMEOUT_MS;
	while (!done() && Date.now() < deadline) {
		const garbage: string[] = Array.from({ length: CHURN_BATCH }, (_: string | undefined, index: number): string => `entry-${String(index)}`);
		retained.push(garbage.slice(0, 1_000));
		await new Promise<void>((resolve): void => {
			setImmediate(resolve);
		});
	}
}

describe("NodePostGcHeapProbe", () => {
	it(
		"reports heapUsed right after a real major GC, and nothing once stopped",
		async () => {
			const probe = new NodePostGcHeapProbe();
			const samples: HeapSample[] = [];
			const witnessed: HeapSample[] = [];
			const stop = probe.start((sample: HeapSample): void => {
				samples.push(sample);
			});
			// A second, independent subscription proves major GCs keep happening after `stop()`.
			const stopWitness = new NodePostGcHeapProbe().start((sample: HeapSample): void => {
				witnessed.push(sample);
			});

			await churnUntil((): boolean => samples.length > 0);
			stop();
			const countAtStop = samples.length;
			const witnessedAtStop = witnessed.length;
			await churnUntil((): boolean => witnessed.length > witnessedAtStop + 1);
			stopWitness();

			expect(countAtStop).toBeGreaterThan(0);
			expect(samples[LIST_SLOT_INDEX.first]?.heapUsedBytes).toBeGreaterThan(0);
			expect(witnessed.length).toBeGreaterThan(witnessedAtStop + 1);
			expect(samples).toHaveLength(countAtStop);
		},
		2 * MAJOR_GC_TIMEOUT_MS + 5_000,
	);
});
