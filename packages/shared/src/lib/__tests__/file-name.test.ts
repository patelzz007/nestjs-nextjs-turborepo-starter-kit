import { describe, expect, it } from "vitest";

import { DEFAULT_FILE_NAME_SEGMENT_MAX_LENGTH, safeFileNameSegment } from "../file-name";

describe("safeFileNameSegment", () => {
	it("lower-cases the value and turns every run of other characters into one dash", () => {
		expect(safeFileNameSegment("Weekend Brunch: 20% off!", "file")).toBe("weekend-brunch-20-off");
	});

	it("drops non-ASCII letters, path separators and dots", () => {
		expect(safeFileNameSegment("../Café/../Tarik", "file")).toBe("caf-tarik");
	});

	it("falls back when nothing safe is left", () => {
		expect(safeFileNameSegment("咖啡 !!", "photos")).toBe("photos");
	});

	it("caps the length without leaving a dash at the end", () => {
		expect(safeFileNameSegment("a".repeat(DEFAULT_FILE_NAME_SEGMENT_MAX_LENGTH + 10), "file")).toHaveLength(DEFAULT_FILE_NAME_SEGMENT_MAX_LENGTH);
		expect(safeFileNameSegment("abcd efgh", "file", 5)).toBe("abcd");
	});
});
