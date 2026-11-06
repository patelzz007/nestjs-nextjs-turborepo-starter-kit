import { describe, expect, it } from "vitest";

import { fitEnd, fitStart, formatCount, plural, shortPackage } from "../text.ts";

describe("fitStart and fitEnd", () => {
	it("leave what fits alone", () => {
		expect(fitStart("abc", 3)).toBe("abc");
		expect(fitEnd("abc", 3)).toBe("abc");
	});

	it("keep the end of a path, or the start of a sentence", () => {
		expect(fitStart("src/deep/file.ts", 8)).toBe("…file.ts");
		expect(fitEnd("a long sentence", 6)).toBe("a lon…");
	});

	it("give nothing for no room", () => {
		expect(fitStart("abc", 0)).toBe("");
		expect(fitEnd("abc", -1)).toBe("");
	});
});

describe("formatCount and plural", () => {
	it("group thousands and agree with the count", () => {
		expect(formatCount(18_143)).toBe("18,143");
		expect(plural(1, "test")).toBe("1 test");
		expect(plural(2, "test")).toBe("2 tests");
	});
});

describe("shortPackage", () => {
	it("drops the shared scope only", () => {
		expect(shortPackage("@workspace/api")).toBe("api");
		expect(shortPackage("//")).toBe("//");
		expect(shortPackage("plain")).toBe("plain");
	});
});
