import { describe, expect, it } from "vitest";

import { declaration, declaredNames, DuplicateCssDeclarationError, printComment, printStylesheet, rule } from "./css";

describe("printStylesheet", () => {
	it("prints the header, then each top-level rule separated by a blank line, with tab indentation and a trailing newline", () => {
		const css = printStylesheet(["Header line"], [rule(":root", [declaration("card", "white")]), rule("@layer theme", [rule(":root", [declaration("card", "black")])])]);

		expect(css).toBe(
			["/*", " * Header line", " */", "", ":root {", "\t--card: white;", "}", "", "@layer theme {", "\t:root {", "\t\t--card: black;", "\t}", "}", ""].join("\n"),
		);
	});

	it("throws when one block declares the same property twice", () => {
		expect(() => printStylesheet([], [rule(":root", [declaration("card", "white"), declaration("card", "black")])])).toThrow(DuplicateCssDeclarationError);
	});

	it("allows the same property in different blocks", () => {
		expect(() => printStylesheet([], [rule(":root", [declaration("card", "white")]), rule(".dark", [declaration("card", "black")])])).not.toThrow();
	});
});

describe("printComment", () => {
	it("writes an empty entry as a bare comment line", () => {
		expect(printComment(["First", "", "Second"])).toBe(["/*", " * First", " *", " * Second", " */"].join("\n"));
	});
});

describe("declaredNames", () => {
	it("lists only the declarations directly inside the rule", () => {
		expect(declaredNames(rule(":root", [declaration("outer", "1"), rule("@variant dark", [declaration("inner", "2")])]))).toStrictEqual(["outer"]);
	});
});
