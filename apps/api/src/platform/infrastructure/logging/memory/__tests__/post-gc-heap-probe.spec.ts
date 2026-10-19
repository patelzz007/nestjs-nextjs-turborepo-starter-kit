import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import type { HeapSample } from "../heap-growth-detector";
import { NodePostGcHeapProbe } from "../post-gc-heap-probe";

/**
 * GC performance entries reach observers asynchronously, a few event-loop turns
 * after the collection. This bounds how many turns a spec waits for one.
 */
const MAX_DELIVERY_TURNS = 200;

/** The `gc()` that `--expose-gc` installs (apps/api/vitest.config.unit.ts passes it to every worker). */
function exposedGc(): NodeJS.GCFunction {
	const { gc } = globalThis;
	if (gc === undefined) {
		throw new Error("globalThis.gc is missing: run the API unit specs with --expose-gc (apps/api/vitest.config.unit.ts execArgv)");
	}
	return gc;
}

/** Forces a real major (mark-compact) collection — the event the probe reports. */
function runMajorGc(): void {
	exposedGc()({ type: "major", execution: "sync" });
}

async function nextTurn(): Promise<void> {
	await new Promise<void>((resolve): void => {
		setImmediate(resolve);
	});
}

/** Yields to the event loop until `delivered()` or the delivery bound. */
async function awaitDelivery(delivered: () => boolean): Promise<void> {
	for (let turn = 0; turn < MAX_DELIVERY_TURNS && !delivered(); turn += 1) {
		await nextTurn();
	}
}

describe("NodePostGcHeapProbe", () => {
	it("reports heapUsed right after a real major GC, and nothing once stopped", async () => {
		const probe = new NodePostGcHeapProbe();
		const samples: HeapSample[] = [];
		const witnessed: HeapSample[] = [];
		const stop = probe.start((sample: HeapSample): void => {
			samples.push(sample);
		});
		// A second, independent subscription proves a major GC still happened after `stop()`.
		const stopWitness = new NodePostGcHeapProbe().start((sample: HeapSample): void => {
			witnessed.push(sample);
		});

		runMajorGc();
		await awaitDelivery((): boolean => samples.length > 0);
		stop();
		const countAtStop = samples.length;
		const witnessedAtStop = witnessed.length;

		runMajorGc();
		await awaitDelivery((): boolean => witnessed.length > witnessedAtStop);
		stopWitness();

		expect(countAtStop).toBeGreaterThan(0);
		expect(samples[LIST_SLOT_INDEX.first]?.heapUsedBytes).toBeGreaterThan(0);
		expect(witnessed.length).toBeGreaterThan(witnessedAtStop);
		expect(samples).toHaveLength(countAtStop);
	});
});
