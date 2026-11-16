import { ansiToCodeLines, codeRows, highlightRanges, markTokens, type CodeLine } from "../code-block";

const LINE: CodeLine = [{ text: "const ", role: "keyword" }, { text: "total", role: "constant" }, { text: " = sum(items);" }];

describe("the CodeBlock's line maths", () => {
	it("finds highlights, ignoring case unless asked, dropping overlaps and empty needles", () => {
		expect(highlightRanges("Sum sum SUM", [{ text: "sum" }])).toEqual([
			{ start: 0, end: 3, kind: "word" },
			{ start: 4, end: 7, kind: "word" },
			{ start: 8, end: 11, kind: "word" },
		]);
		expect(highlightRanges("Sum sum", [{ text: "sum", caseSensitive: true, kind: "match" }])).toEqual([{ start: 4, end: 7, kind: "match" }]);
		expect(highlightRanges("total", [{ text: "tot" }, { text: "otal" }, { text: "" }])).toEqual([{ start: 0, end: 3, kind: "word" }]);
	});

	it("cuts tokens where highlights start and end, keeping their roles", () => {
		const marked = markTokens(LINE, highlightRanges("const total = sum(items);", [{ text: "tal = s" }]));
		expect(marked.map((token) => [token.text, token.role, token.highlight])).toEqual([
			["const ", "keyword", undefined],
			["to", "constant", undefined],
			["tal", "constant", "word"],
			[" = s", undefined, "word"],
			["um(items);", undefined, undefined],
		]);
		expect(markTokens(LINE, [])).toBe(LINE);
	});

	it("lays out lines with their notes under them, and a folded region as its first line and a summary", () => {
		const lines: readonly CodeLine[] = [[{ text: "a" }], [{ text: "b" }], [{ text: "c" }], [{ text: "d" }]];
		const rows = codeRows(
			lines,
			10,
			[{ line: 10, text: "first" }],
			[
				{ start: 11, end: 13 },
				{ start: 13, end: 13 },
			],
			new Set([11, 13]),
		);
		expect(rows.map((row) => `${row.kind}:${String(row.number)}`)).toEqual(["line:10", "note:10", "line:11", "fold:11"]);
		expect(codeRows(lines, 1, [], [{ start: 2, end: 3 }], new Set()).map((row) => row.kind)).toEqual(["line", "line", "line", "line"]);
	});

	it("reads terminal colour codes as roles, dim as dim, resets per line, and drops the rest", () => {
		const lines = ansiToCodeLines(
			"\u001b[32m✓\u001b[0m passed \u001b[2m(12 ms)\u001b[22m done\n\u001b[1;91mFAIL\u001b[39m x \u001b[38;5;200mpink\u001b[m\n\u001b[33mopen\nend\u001b[33",
		);
		expect(lines.at(0)).toEqual([
			{ text: "✓", role: "green" },
			{ text: " passed ", role: "plain" },
			{ text: "(12 ms)", role: "dim" },
			{ text: " done", role: "plain" },
		]);
		expect(lines.at(1)).toEqual([
			{ text: "FAIL", role: "red" },
			{ text: " x ", role: "plain" },
			{ text: "pink", role: "plain" },
		]);
		expect(lines.at(2)).toEqual([{ text: "open", role: "yellow" }]);
		expect(lines.at(3)).toEqual([{ text: "end", role: "plain" }]);
	});
});
