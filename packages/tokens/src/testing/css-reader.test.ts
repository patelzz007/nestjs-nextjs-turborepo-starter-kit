import { describe, expect, it } from "vitest";

import { readDeclarations } from "./css-reader";

const NESTED_CSS = [":root {", "\t--outer: 1;", "\t@variant dark {", "\t\t--inner: 2;", "\t}", "\t--after: 3;", "}", ""].join("\n");

describe("readDeclarations", () => {
	it("reads the declarations directly inside a block, skipping nested blocks", () => {
		expect([...readDeclarations(NESTED_CSS, ":root")]).toStrictEqual([
			["outer", "1"],
			["after", "3"],
		]);
	});

	it("reads a nested block by its selector", () => {
		expect([...readDeclarations(NESTED_CSS, "@variant dark")]).toStrictEqual([["inner", "2"]]);
	});

	it("throws when the block does not exist", () => {
		expect(() => readDeclarations(NESTED_CSS, ".dark")).toThrow('No ".dark" block');
	});

	it("throws when the block is never closed", () => {
		expect(() => readDeclarations(":root {\n\t--open: 1;\n", ":root")).toThrow("never closed");
	});
});
