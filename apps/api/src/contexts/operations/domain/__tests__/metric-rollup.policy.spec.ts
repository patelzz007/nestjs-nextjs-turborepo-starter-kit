import { epochMs, type OpsDependencyPoint, type OpsInstancePoint, type OpsServerPoint } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { rollUp, rollUpDependencyPoints, rollUpInstancePoints, rollUpServerPoints } from "../policies/metric-rollup.policy";

const HOUR = epochMs(3_600_000);

function serverPoint(cpu: number, overrides: Partial<OpsServerPoint> = {}): OpsServerPoint {
	return {
		bucketStart: epochMs(0),
		cpuPercentAvg: cpu,
		cpuPercentMax: cpu + 10,
		stealPercentAvg: null,
		iowaitPercentAvg: null,
		load1Avg: 1,
		memoryUsedBytes: 100,
		memoryTotalBytes: 1_000,
		memoryPercentMax: 10,
		swapUsedBytes: 0,
		diskUsedBytes: 500,
		diskTotalBytes: 1_000,
		diskPercentMax: 50,
		inodesPercentMax: null,
		diskReadBytesPerSec: 1,
		diskWriteBytesPerSec: 1,
		netRxBytesPerSec: 1,
		netTxBytesPerSec: 1,
		tcpConnections: 1,
		processCount: 1,
		...overrides,
	};
}

describe("rollUp", () => {
	it("is null for no points and combines each figure by its strategy", () => {
		expect(rollUp([], () => 1)).toBeNull();
		const points = [
			{ v: 1, o: null },
			{ v: 3, o: 4 },
			{ v: 2, o: null },
		];
		expect(
			rollUp(points, (pick) => ({
				avg: pick.required("avg", (point) => point.v),
				max: pick.required("max", (point) => point.v),
				sum: pick.required("sum", (point) => point.v),
				last: pick.required("last", (point) => point.v),
				optionalAvg: pick.optional("avg", (point) => point.o),
				none: pick.optional("max", () => null),
			})),
		).toEqual({ avg: 2, max: 3, sum: 6, last: 2, optionalAvg: 4, none: null });
	});
});

describe("rollUpServerPoints", () => {
	it("averages usage, keeps peaks, and takes the latest sizes", () => {
		const bucket = rollUpServerPoints([serverPoint(10), serverPoint(30, { diskUsedBytes: 600, cpuPercentMax: 80, stealPercentAvg: 2 })], HOUR);

		expect(bucket).toMatchObject({ bucketStart: HOUR, cpuPercentAvg: 20, cpuPercentMax: 80, diskUsedBytes: 600, stealPercentAvg: 2, iowaitPercentAvg: null });
	});
});

describe("rollUpInstancePoints", () => {
	it("adds up requests and errors and keeps the worst latency", () => {
		const point = (requests: number, p95: number | null): OpsInstancePoint => ({
			bucketStart: epochMs(0),
			cpuPercentAvg: 10,
			cpuPercentMax: 20,
			rssBytes: 100,
			heapUsedBytes: 50,
			eventLoopLagP99Ms: 5,
			gcPauseMs: 1,
			requestCount: requests,
			serverErrorCount: 1,
			clientErrorCount: 0,
			latencyP50Ms: null,
			latencyP95Ms: p95,
			latencyP99Ms: null,
		});

		expect(rollUpInstancePoints([point(100, 40), point(50, null), point(10, 90)], HOUR)).toMatchObject({
			requestCount: 160,
			serverErrorCount: 3,
			gcPauseMs: 3,
			latencyP95Ms: 90,
			latencyP50Ms: null,
		});
	});
});

describe("rollUpDependencyPoints", () => {
	it("averages up-time and rounds connection peaks", () => {
		const point = (up: number, connections: number | null): OpsDependencyPoint => ({
			bucketStart: epochMs(0),
			upPercent: up,
			latencyMsAvg: null,
			connectionsUsed: connections,
			sizeBytes: null,
			memoryUsedBytes: null,
			backlog: null,
			failed: null,
		});

		expect(rollUpDependencyPoints([point(100, 4), point(0, 9), point(100, null)], HOUR)).toMatchObject({ upPercent: 200 / 3, connectionsUsed: 9, latencyMsAvg: null });
	});
});
