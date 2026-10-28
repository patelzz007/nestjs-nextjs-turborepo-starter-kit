import { describe, expect, it } from "vitest";

import { formatAgo, formatByteRate, formatBytes, formatCount, formatMs, formatPercent, formatUptime, gaugeTone, percentOf } from "../ops-format";

describe("operations number formats", () => {
	it("formats bytes with the right unit", () => {
		expect(formatBytes(null)).toBe("—");
		expect(formatBytes(512)).toBe("512 B");
		expect(formatBytes(1_536)).toBe("1.5 KB");
		expect(formatBytes(36 * 1_024 ** 3)).toBe("36.0 GB");
		expect(formatBytes(1_000 * 1_024 ** 3)).toBe("1000 GB");
		expect(formatByteRate(2_048)).toBe("2.0 KB/s");
		expect(formatByteRate(null)).toBe("—");
	});

	it("formats percents, milliseconds and counts", () => {
		expect(formatPercent(42.6)).toBe("43%");
		expect(formatPercent(null)).toBe("—");
		expect(formatMs(12.4)).toBe("12 ms");
		expect(formatMs(1_240)).toBe("1.24 s");
		expect(formatMs(null)).toBe("—");
		expect(formatCount(12_345.6)).toBe("12,346");
		expect(formatCount(null)).toBe("—");
	});

	it("formats uptime and time ago", () => {
		expect(formatUptime(40)).toBe("40s");
		expect(formatUptime(8 * 60)).toBe("8m");
		expect(formatUptime(5 * 3_600 + 12 * 60)).toBe("5h 12m");
		expect(formatUptime(3 * 86_400 + 4 * 3_600)).toBe("3d 4h");
		expect(formatUptime(null)).toBe("—");
		expect(formatAgo(null, 0)).toBe("never");
		expect(formatAgo(0, 30_000)).toBe("just now");
		expect(formatAgo(0, 3 * 60_000)).toBe("3 min ago");
		expect(formatAgo(0, 2 * 3_600_000)).toBe("2 h ago");
		expect(formatAgo(0, 5 * 86_400_000)).toBe("5 d ago");
	});

	it("computes a capped share and its tone", () => {
		expect(percentOf(1, 4)).toBe(25);
		expect(percentOf(5, 4)).toBe(100);
		expect(percentOf(1, 0)).toBe(0);
		expect(gaugeTone(50)).toBe("success");
		expect(gaugeTone(75)).toBe("warning");
		expect(gaugeTone(90)).toBe("danger");
	});
});
