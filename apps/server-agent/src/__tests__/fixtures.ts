// Test data for the agent: one machine's sample and facts, overridable per test.

import { epochMs, type OpsHostFacts, type OpsServerLive } from "@workspace/shared";

import type { Machine } from "../machine";

const GIB = 1_073_741_824;

export function liveSample(overrides: Partial<OpsServerLive> = {}): OpsServerLive {
	return {
		sampledAt: epochMs(1_700_000_000_000),
		cpuPercent: 20,
		perCorePercent: [10, 30],
		stealPercent: null,
		iowaitPercent: null,
		load1: 1,
		load5: 1,
		load15: 1,
		memoryUsedBytes: 4 * GIB,
		memoryTotalBytes: 8 * GIB,
		swapUsedBytes: 0,
		swapTotalBytes: GIB,
		disks: [{ mount: "/", usedBytes: 50 * GIB, totalBytes: 100 * GIB, inodesPercent: 10 }],
		diskReadBytesPerSec: 100,
		diskWriteBytesPerSec: 200,
		diskReadIops: null,
		diskWriteIops: null,
		netRxBytesPerSec: 1_000,
		netTxBytesPerSec: 2_000,
		tcpConnections: 10,
		openFiles: null,
		processCount: 300,
		topProcesses: [],
		...overrides,
	};
}

export const HOST_FACTS: OpsHostFacts = {
	hostname: "web-01",
	os: "Ubuntu 24.04",
	kernel: "6.8.0",
	cpuModel: "Intel Xeon",
	cpuCores: 2,
	memoryTotalBytes: 8 * GIB,
	uptimeSeconds: 3_600,
};

/** A machine that answers the queued samples in order (the last one repeats). */
export class FakeMachine implements Machine {
	public constructor(private readonly _samples: readonly OpsServerLive[]) {}

	private _taken = 0;

	public facts(): Promise<OpsHostFacts> {
		return Promise.resolve(HOST_FACTS);
	}

	public sample(): Promise<OpsServerLive> {
		const sample: OpsServerLive | undefined = this._samples.at(Math.min(this._taken, this._samples.length - 1));
		this._taken += 1;
		return sample === undefined ? Promise.reject(new Error("no sample")) : Promise.resolve(sample);
	}
}
