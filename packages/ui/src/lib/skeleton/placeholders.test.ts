import { describe, expect, it } from "vitest";

import { cycledWidth, placeholderKeys } from "./placeholders";

describe("placeholderKeys", () => {
	it("returns count stable, prefixed, position-based keys", (): void => {
		expect(placeholderKeys("row", 3)).toEqual(["row-0", "row-1", "row-2"]);
	});

	it("returns no keys for a zero count", (): void => {
		expect(placeholderKeys("row", 0)).toEqual([]);
	});
});

describe("cycledWidth", () => {
	const WIDTHS: readonly string[] = ["w-1/2", "w-2/3"];

	it("walks the cycle and wraps around", (): void => {
		expect([0, 1, 2, 3].map((index) => cycledWidth(WIDTHS, index))).toEqual(["w-1/2", "w-2/3", "w-1/2", "w-2/3"]);
	});

	it("falls back for an empty cycle", (): void => {
		expect(cycledWidth([], 2)).toBe("w-full");
		expect(cycledWidth([], 2, "w-20")).toBe("w-20");
	});
});
