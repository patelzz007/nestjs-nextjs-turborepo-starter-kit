import { describe, expect, it } from "vitest";

import { parseCodeTitle, parseFenceAttribute, parseHighlightLines } from "../fence-meta";

describe("parseHighlightLines", () => {
	it("expands ranges and single lines", () => {
		expect(parseHighlightLines("{2-4,7}")).toEqual([2, 3, 4, 7]);
	});

	it("ignores malformed parts and missing braces", () => {
		expect(parseHighlightLines("{a, 3}")).toEqual([3]);
		expect(parseHighlightLines('title="x"')).toEqual([]);
	});
});

describe("parseCodeTitle", () => {
	it("reads a quoted title", () => {
		expect(parseCodeTitle('title="astro.config.ts" {1}')).toBe("astro.config.ts");
		expect(parseCodeTitle("{1}")).toBeNull();
	});
});

describe("parseFenceAttribute", () => {
	it("reads a named, quoted attribute anywhere in the meta", () => {
		expect(parseFenceAttribute('width="480" height="360"', "height")).toBe("360");
		expect(parseFenceAttribute('width="480"', "width")).toBe("480");
		expect(parseFenceAttribute('width="480"', "height")).toBeNull();
	});

	it("never matches inside another attribute's name", () => {
		expect(parseFenceAttribute('maxwidth="900"', "width")).toBeNull();
	});
});
