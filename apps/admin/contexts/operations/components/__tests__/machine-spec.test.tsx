// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { epochMs, type OpsServerLive } from "@workspace/shared";
import { afterEach, describe, expect, it } from "vitest";

import { MachineSpec } from "../machine-spec";

const GIB = 1_024 ** 3;

function live(overrides: Partial<OpsServerLive> = {}): OpsServerLive {
	return {
		sampledAt: epochMs(0),
		cpuPercent: 20,
		perCorePercent: [20],
		stealPercent: null,
		iowaitPercent: null,
		load1: 1,
		load5: 1,
		load15: 1,
		memoryUsedBytes: 6 * GIB,
		memoryTotalBytes: 8 * GIB,
		swapUsedBytes: 0,
		swapTotalBytes: 0,
		disks: [{ mount: "/", usedBytes: 100 * GIB, totalBytes: 160 * GIB, inodesPercent: 10 }],
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
		...overrides,
	};
}

const SERVER = { cpuModel: "DO-Premium-AMD", cpuCores: 4, memoryTotalBytes: 8 * GIB, uptimeSeconds: 3_600, os: "Ubuntu 24.04", hostname: "web-01" };

describe("MachineSpec", () => {
	afterEach(() => {
		cleanup();
	});

	it("shows each resource's size, used and free", () => {
		render(<MachineSpec server={SERVER} live={live()} />);

		expect(screen.getByText("DO-Premium-AMD")).toBeDefined();
		expect(screen.getByText("6.0 GB used (75%)")).toBeDefined();
		expect(screen.getByText("2.0 GB free")).toBeDefined();
		expect(screen.getByText("100 GB used (63%)")).toBeDefined();
		expect(screen.getByText("60.0 GB free")).toBeDefined();
		expect(screen.queryByText("Swap")).toBeNull();
	});

	it("still shows the spec when the agent is silent", () => {
		render(<MachineSpec server={SERVER} live={null} />);

		expect(screen.getByText("Memory (RAM)")).toBeDefined();
		expect(screen.getByText("8.0 GB")).toBeDefined();
		expect(screen.getAllByText("Used —")).toHaveLength(2);
	});
});
