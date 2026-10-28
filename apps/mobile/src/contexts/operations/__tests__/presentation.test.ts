import { epochMs, type OpsServerPoint } from "@workspace/shared";

import { bucketLabel, MAX_CHART_BUCKETS, tickLabel, usageBuckets } from "../presentation";

function point(index: number, cpu: number, memoryUsed: number): OpsServerPoint {
	return {
		bucketStart: epochMs(index * 60_000),
		cpuPercentAvg: cpu,
		cpuPercentMax: cpu,
		stealPercentAvg: null,
		iowaitPercentAvg: null,
		load1Avg: 0,
		memoryUsedBytes: memoryUsed,
		memoryTotalBytes: 100,
		memoryPercentMax: memoryUsed,
		swapUsedBytes: 0,
		diskUsedBytes: 0,
		diskTotalBytes: 0,
		diskPercentMax: 0,
		inodesPercentMax: null,
		diskReadBytesPerSec: 0,
		diskWriteBytesPerSec: 0,
		netRxBytesPerSec: 0,
		netTxBytesPerSec: 0,
		tcpConnections: 0,
		processCount: 0,
	};
}

describe("usageBuckets", () => {
	it("keeps a short history as it is", () => {
		expect(usageBuckets([point(0, 10, 40), point(1, 30, 60)])).toEqual([
			{ at: 0, cpu: 10, memory: 40 },
			{ at: 60_000, cpu: 30, memory: 60 },
		]);
	});

	it("averages a long history into at most the chart's buckets", () => {
		const day = Array.from({ length: 1_440 }, (_unused, index) => point(index, index % 2 === 0 ? 10 : 30, 50));
		const buckets = usageBuckets(day);

		// 1 440 minutes in 96 buckets: 15 minutes each, so the first holds eight 10s and seven 30s.
		const pointsPerBucket = 15;
		expect(buckets).toHaveLength(MAX_CHART_BUCKETS);
		expect(buckets.at(0)).toEqual({ at: 0, cpu: (8 * 10 + 7 * 30) / pointsPerBucket, memory: 50 });
		expect(buckets.at(1)?.at).toBe(pointsPerBucket * 60_000);
	});

	it("is empty without history", () => {
		expect(usageBuckets([])).toEqual([]);
	});
});

describe("labels", () => {
	const at = Date.UTC(2026, 9, 28, 14, 5);

	it("shows clock times for a day or less and dates beyond", () => {
		expect(tickLabel(at, "24h")).toMatch(/^\d{2}:\d{2}$/);
		expect(tickLabel(at, "7d")).toMatch(/Oct/);
	});

	it("reads a bucket in full", () => {
		expect(bucketLabel(at)).toMatch(/Oct/);
	});
});
