import { describe, expect, it } from "vitest";

import { IowaitMeter } from "../machine";

/** A `/proc/stat` whose cpu line has these counters (user nice system idle iowait …). */
function procStat(counters: readonly number[]): string {
	return `cpu  ${counters.join(" ")}\ncpu0 1 2 3 4 5\n`;
}

describe("IowaitMeter", () => {
	it("needs two readings, then reports iowait's share of the time between them", async () => {
		const readings = [procStat([100, 0, 100, 700, 100]), procStat([150, 0, 150, 850, 150])];
		const meter = new IowaitMeter((): Promise<string> => Promise.resolve(readings.shift() ?? ""));

		expect(await meter.percent()).toBeNull();
		expect(await meter.percent()).toBe(16.666666666666664);
	});

	it("is null when the counters did not move or cannot be read", async () => {
		const same = new IowaitMeter((): Promise<string> => Promise.resolve(procStat([1, 1, 1, 1, 1])));
		await same.percent();
		expect(await same.percent()).toBeNull();

		const unreadable = new IowaitMeter((): Promise<string> => Promise.resolve("intr 1 2 3\n"));
		expect(await unreadable.percent()).toBeNull();
	});
});
