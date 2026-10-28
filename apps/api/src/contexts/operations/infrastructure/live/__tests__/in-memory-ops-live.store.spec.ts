import { epochMs, OPS_LIVE_SAMPLE_TTL_MS, type OpsInstanceLive, type OpsServerLive } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { InMemoryOpsLiveStore } from "../redis-ops-live.store";

const SAMPLE: OpsServerLive = {
	sampledAt: epochMs(0),
	cpuPercent: 1,
	perCorePercent: [1],
	stealPercent: null,
	iowaitPercent: null,
	load1: 0,
	load5: 0,
	load15: 0,
	memoryUsedBytes: 1,
	memoryTotalBytes: 2,
	swapUsedBytes: 0,
	swapTotalBytes: 0,
	disks: [],
	diskReadBytesPerSec: 0,
	diskWriteBytesPerSec: 0,
	diskReadIops: null,
	diskWriteIops: null,
	netRxBytesPerSec: 0,
	netTxBytesPerSec: 0,
	tcpConnections: 0,
	openFiles: null,
	processCount: 1,
	topProcesses: [],
};

function instance(instanceId: string, sampledAt: number): OpsInstanceLive {
	return {
		instanceId,
		service: "api",
		hostname: "h",
		pid: 1,
		version: "v1",
		startedAt: epochMs(0),
		sampledAt: epochMs(sampledAt),
		cpuPercent: 0,
		rssBytes: 0,
		heapUsedBytes: 0,
		heapTotalBytes: 0,
		eventLoopLagP99Ms: 0,
		gcPauseMs: 0,
		activeHandles: 0,
		dbPoolInUse: null,
		dbPoolWaiting: null,
		requestsPerMinute: 0,
		serverErrorsPerMinute: 0,
		clientErrorsPerMinute: 0,
		latencyP50Ms: null,
		latencyP95Ms: null,
		latencyP99Ms: null,
		slowestEndpoints: [],
	};
}

describe("InMemoryOpsLiveStore", () => {
	it("keeps a server's live sample for its TTL", async () => {
		let now = 0;
		const store = new InMemoryOpsLiveStore(() => now);
		await store.putServerLive("s1", SAMPLE);

		expect((await store.serverLive(["s1", "s2"])).size).toBe(1);
		now = OPS_LIVE_SAMPLE_TTL_MS + 1;
		expect((await store.serverLive(["s1"])).size).toBe(0);
	});

	it("lets one instance claim a minute's job", async () => {
		const store = new InMemoryOpsLiveStore();

		expect(await store.claimMinute("rollup", 60_000)).toBe(true);
		expect(await store.claimMinute("rollup", 60_000)).toBe(false);
		expect(await store.claimMinute("rollup", 120_000)).toBe(true);
	});

	it("prunes instances that stopped reporting", async () => {
		const store = new InMemoryOpsLiveStore();
		await store.putInstance(instance("old", 10));
		await store.putInstance(instance("new", 100));

		expect(await store.pruneInstances(50)).toBe(1);
		expect((await store.instances()).map((live) => live.instanceId)).toEqual(["new"]);
		await store.removeInstance("new");
		expect(await store.instances()).toEqual([]);
	});

	it("spends a ticket on first use and refuses an expired one", async () => {
		let now = 0;
		const store = new InMemoryOpsLiveStore(() => now);
		await store.putTicket("t1", "backup-1", 1_000);
		await store.putTicket("t2", "backup-2", 1_000);

		expect(await store.takeTicket("t1")).toBe("backup-1");
		expect(await store.takeTicket("t1")).toBeNull();
		now = 2_000;
		expect(await store.takeTicket("t2")).toBeNull();
	});

	it("records stop requests and dependency statuses", async () => {
		const store = new InMemoryOpsLiveStore();
		await store.requestStop("run-1");
		await store.putDependencies([]);

		expect(store.stopped.has(store.stopFlagKey("run-1"))).toBe(true);
		expect(await store.dependencies()).toEqual([]);
	});
});
