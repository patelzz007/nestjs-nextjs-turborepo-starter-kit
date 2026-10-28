import { describe, expect, it } from "vitest";

import { formatBytes, formatPercent, formatUptime, machineSpecLine, percentOf, storageTotals, usageLevel } from "../machine-usage";

const GIB = 1_024 ** 3;

describe("machine usage formats", () => {
	it("formats bytes, percents and uptime", () => {
		expect(formatBytes(null)).toBe("—");
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(1_536)).toBe("1.5 KB");
		expect(formatBytes(36 * GIB)).toBe("36.0 GB");
		expect(formatPercent(42.6)).toBe("43%");
		expect(formatPercent(null)).toBe("—");
		expect(formatUptime(40)).toBe("40s");
		expect(formatUptime(8 * 60)).toBe("8m");
		expect(formatUptime(5 * 3_600 + 12 * 60)).toBe("5h 12m");
		expect(formatUptime(3 * 86_400 + 4 * 3_600)).toBe("3d 4h");
		expect(formatUptime(null)).toBe("—");
	});

	it("computes a capped share and how full it is", () => {
		expect(percentOf(1, 4)).toBe(25);
		expect(percentOf(5, 4)).toBe(100);
		expect(percentOf(1, 0)).toBe(0);
		expect(usageLevel(74)).toBe("ok");
		expect(usageLevel(75)).toBe("warning");
		expect(usageLevel(90)).toBe("danger");
	});
});

describe("storageTotals", () => {
	it("adds up distinct disks", () => {
		expect(
			storageTotals([
				{ mount: "/", usedBytes: 10, totalBytes: 100, inodesPercent: null },
				{ mount: "/data", usedBytes: 50, totalBytes: 500, inodesPercent: null },
			]),
		).toEqual({ totalBytes: 600, usedBytes: 60 });
	});

	it("counts volumes of one container once, at the fullest volume's usage", () => {
		expect(
			storageTotals([
				{ mount: "/", usedBytes: 12, totalBytes: 1_000, inodesPercent: null },
				{ mount: "/System/Volumes/Data", usedBytes: 580, totalBytes: 1_000, inodesPercent: null },
			]),
		).toEqual({ totalBytes: 1_000, usedBytes: 580 });
	});
});

describe("machineSpecLine", () => {
	const disks = [{ mount: "/", usedBytes: 100 * GIB, totalBytes: 160 * GIB, inodesPercent: 10 }];

	it("reads the CPU, cores, RAM and storage", () => {
		expect(machineSpecLine({ cpuModel: "DO-Premium-AMD", cpuCores: 4, memoryTotalBytes: 8 * GIB, live: { disks } })).toBe(
			"DO-Premium-AMD · 4 cores · 8.0 GB RAM · 160 GB storage",
		);
	});

	it("leaves out what is not known, and says when nothing is", () => {
		expect(machineSpecLine({ cpuModel: "DO-Premium-AMD", cpuCores: 4, memoryTotalBytes: 8 * GIB, live: null })).toBe("DO-Premium-AMD · 4 cores · 8.0 GB RAM");
		expect(machineSpecLine({ cpuModel: null, cpuCores: null, memoryTotalBytes: null, live: null })).toBe("Spec arrives with the agent's first report");
	});
});
