import type { CodeBlockLine } from "@workspace/ui-native/components/code-block";

import { characterCount, revealLines, snippet } from "../examples/code-block/code-block-sample";

describe("the CodeBlock examples' sample", () => {
	it("reads a coloured snippet by id, and nothing for an unknown one", () => {
		const session = snippet("session");
		expect(session.code).toContain("signIn");
		expect(session.lines.length).toBe(session.code.split("\n").length);
		expect(session.lines.flat().some((token) => token.role === "keyword")).toBe(true);
		expect(snippet("nope")).toEqual({ code: "", lines: [] });
	});

	it("reveals the first characters of coloured lines, a line break counting as one", () => {
		const lines: readonly CodeBlockLine[] = [[{ text: "ab", role: "keyword" }, { text: "c" }], [{ text: "de" }]];
		expect(characterCount(lines)).toBe(7);
		expect(revealLines(lines, 2)).toEqual([[{ text: "ab", role: "keyword" }]]);
		expect(revealLines(lines, 5)).toEqual([[{ text: "ab", role: "keyword" }, { text: "c" }], [{ text: "d" }]]);
		expect(revealLines(lines, 0)).toEqual([]);
	});
});
