import { epochMs, type OpsServerPoint } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { shareChange, usageSeries } from "../server-focus";

function point(at: number, cpu: number, memoryUsed: number, disk: number): OpsServerPoint {
	return {
		bucketStart: epochMs(at),
		cpuPercentAvg: cpu,
		cpuPercentMax: cpu,
		stealPercentAvg: null,
		iowaitPercentAvg: null,
		load1Avg: 1,
		memoryUsedBytes: memoryUsed,
		memoryTotalBytes: 100,
		memoryPercentMax: memoryUsed,
		swapUsedBytes: 0,
		diskUsedBytes: disk,
		diskTotalBytes: 100,
		diskPercentMax: disk,
		inodesPercentMax: null,
		diskReadBytesPerSec: 0,
		diskWriteBytesPerSec: 0,
		netRxBytesPerSec: 0,
		netTxBytesPerSec: 0,
		tcpConnections: 0,
		processCount: 0,
	};
}

describe("shareChange", () => {
	it("words a move in percentage points over the range", () => {
		expect(shareChange(20, 32.4, "24h")).toEqual({ delta: 12, label: "12 pts higher than 24 hours ago", higherIsWorse: true });
		expect(shareChange(50, 45, "1h")).toEqual({ delta: -5, label: "5 pts lower than 1 hour ago", higherIsWorse: true });
		expect(shareChange(50, 50.2, "7d")?.label).toBe("Same as 7 days ago");
	});

	it("is null without history", () => {
		expect(shareChange(undefined, 10, "1h")).toBeNull();
	});
});

describe("usageSeries", () => {
	it("reads CPU, memory share and disk share by time", () => {
		expect(usageSeries([point(0, 10, 40, 50), point(60_000, 30, 60, 51)])).toEqual({
			cpu: [
				{ at: 0, value: 10 },
				{ at: 60_000, value: 30 },
			],
			memory: [
				{ at: 0, value: 40 },
				{ at: 60_000, value: 60 },
			],
			disk: [
				{ at: 0, value: 50 },
				{ at: 60_000, value: 51 },
			],
		});
	});
});
