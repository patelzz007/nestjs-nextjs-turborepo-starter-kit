import { formatDateTime, formatRelativeTime } from "./time-format";

const NOW = 1_791_504_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatRelativeTime", () => {
	it.each([
		[NOW - 30_000, "just now"],
		[NOW + 30_000, "in a moment"],
		[NOW - MINUTE, "1 minute ago"],
		[NOW - 5 * MINUTE, "5 minutes ago"],
		[NOW - HOUR, "1 hour ago"],
		[NOW - 3 * HOUR - 10 * MINUTE, "3 hours ago"],
		[NOW + DAY, "in 1 day"],
		[NOW + 6 * DAY + HOUR, "in 6 days"],
	])("formats %s", (epochMs, expected) => {
		expect(formatRelativeTime(epochMs, NOW)).toBe(expected);
	});
});

describe("formatDateTime", () => {
	it("formats in the given display region", () => {
		expect(formatDateTime(Date.UTC(2026, 9, 3, 6, 5), { locale: "en-GB", timeZone: "UTC" })).toBe("3 Oct 2026, 06:05");
	});

	it("uses the platform display region by default", () => {
		expect(formatDateTime(Date.UTC(2026, 9, 3, 6, 5))).toContain("2026");
	});
});
