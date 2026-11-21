import { describe, expect, it } from "vitest";

import {
	escapeTableEngineClipboardHtml,
	parseTableEngineClipboardText,
	renderTableEngineClipboardHtml,
	serializeTableEngineClipboardField,
	serializeTableEngineClipboardText,
	tileTableEngineClipboardBlock,
} from "../table-engine-clipboard";

describe("the data grid's clipboard text", () => {
	it("quotes only fields that hold a tab, a line break or a quote, doubling inner quotes", () => {
		expect(serializeTableEngineClipboardField("plain")).toBe("plain");
		expect(serializeTableEngineClipboardField('say "hi"')).toBe('"say ""hi"""');
		expect(serializeTableEngineClipboardField("a\tb")).toBe('"a\tb"');
		expect(
			serializeTableEngineClipboardText([
				["a", "b"],
				["c", "d\ne"],
			]),
		).toBe('a\tb\r\nc\t"d\ne"');
	});

	it("parses what it writes, Excel's trailing newline and every line-break flavour", () => {
		const grid = [
			["a", 'say "hi"'],
			["multi\nline", "x\ty"],
		];
		expect(parseTableEngineClipboardText(serializeTableEngineClipboardText(grid))).toEqual(grid);
		expect(parseTableEngineClipboardText("a\tb\r\n")).toEqual([["a", "b"]]);
		expect(parseTableEngineClipboardText("a\rb\nc")).toEqual([["a"], ["b"], ["c"]]);
		expect(parseTableEngineClipboardText("")).toEqual([[""]]);
	});

	it("tiles a copied block over a larger selection, and fills an empty block with blanks", () => {
		expect(tileTableEngineClipboardBlock([["1", "2"]], 2, 3)).toEqual([
			["1", "2", "1"],
			["1", "2", "1"],
		]);
		expect(tileTableEngineClipboardBlock([], 1, 2)).toEqual([["", ""]]);
		expect(tileTableEngineClipboardBlock([[]], 1, 1)).toEqual([[""]]);
	});

	it("writes an escaped HTML table, line breaks as <br>", () => {
		expect(escapeTableEngineClipboardHtml("<a & b>")).toBe("&lt;a &amp; b&gt;");
		expect(renderTableEngineClipboardHtml([["x<y", "1\n2"]])).toBe("<table><tbody><tr><td>x&lt;y</td><td>1<br>2</td></tr></tbody></table>");
	});
});
