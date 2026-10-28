import { describe, expect, it } from "vitest";

import { minuteOf, minutePoint } from "../minute";
import { liveSample } from "./fixtures";

const MINUTE = 60_000;
const GIB = 1_073_741_824;

describe("minuteOf", () => {
	it("returns the start of the minute a time is in", () => {
		expect(minuteOf(5 * MINUTE + 59_999)).toBe(5 * MINUTE);
		expect(minuteOf(5 * MINUTE)).toBe(5 * MINUTE);
	});
});

describe("minutePoint", () => {
	it("is null for a minute without samples", () => {
		expect(minutePoint([], 0)).toBeNull();
	});

	it("averages the samples and keeps the peaks", () => {
		const point = minutePoint([liveSample({ cpuPercent: 10, memoryUsedBytes: 2 * GIB }), liveSample({ cpuPercent: 30, memoryUsedBytes: 6 * GIB })], MINUTE);

		expect(point).toMatchObject({ bucketStart: MINUTE, cpuPercentAvg: 20, cpuPercentMax: 30, memoryUsedBytes: 4 * GIB, memoryPercentMax: 75 });
	});

	it("reports the fullest disk, and null for figures no sample measured", () => {
		const point = minutePoint(
			[
				liveSample({
					disks: [
						{ mount: "/", usedBytes: 10, totalBytes: 100, inodesPercent: null },
						{ mount: "/data", usedBytes: 90, totalBytes: 100, inodesPercent: 40 },
					],
				}),
			],
			0,
		);

		expect(point).toMatchObject({ diskUsedBytes: 90, diskTotalBytes: 100, diskPercentMax: 90, inodesPercentMax: 40, stealPercentAvg: null, iowaitPercentAvg: null });
	});

	it("averages only the samples that measured steal and iowait", () => {
		const point = minutePoint([liveSample({ stealPercent: 2, iowaitPercent: null }), liveSample({ stealPercent: 4, iowaitPercent: 6 })], 0);

		expect(point).toMatchObject({ stealPercentAvg: 3, iowaitPercentAvg: 6 });
	});

	it("treats a machine without disks as an empty disk", () => {
		expect(minutePoint([liveSample({ disks: [] })], 0)).toMatchObject({ diskUsedBytes: 0, diskTotalBytes: 0, diskPercentMax: 0, inodesPercentMax: null });
	});
});
