import { describe, expect, it } from "vitest";

import { SECONDS_KEPT, sampleThroughput, startThroughput } from "../throughput.ts";

describe("sampleThroughput", () => {
	it("waits for a whole second before counting", () => {
		const start = startThroughput(1000);

		expect(sampleThroughput(start, 5, 1999)).toBe(start);
	});

	it("counts the files each second finished", () => {
		const first = sampleThroughput(startThroughput(1000), 5, 2000);
		const second = sampleThroughput(first, 12, 3100);

		expect(first.perSecond).toStrictEqual([5]);
		expect(second).toStrictEqual({ perSecond: [5, 7], sampledAtMs: 3000, filesAtSample: 12 });
	});

	it("gives seconds the event loop missed none, and the latest what finished meanwhile", () => {
		expect(sampleThroughput(startThroughput(0), 9, 3500)).toStrictEqual({ perSecond: [0, 0, 9], sampledAtMs: 3000, filesAtSample: 9 });
	});

	it("keeps only the latest seconds", () => {
		const long = sampleThroughput(startThroughput(0), 1, (SECONDS_KEPT + 5) * 1000);

		expect(long.perSecond).toHaveLength(SECONDS_KEPT);
		expect(long.perSecond.at(-1)).toBe(1);
	});
});
