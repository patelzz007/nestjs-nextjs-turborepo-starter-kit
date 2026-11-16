import { describe, expect, it } from "vitest";

import {
	escapeDataGridClipboardHtml,
	parseDataGridClipboardText,
	renderDataGridClipboardHtml,
	serializeDataGridClipboardField,
	serializeDataGridClipboardText,
	tileDataGridClipboardBlock,
} from "../data-grid-clipboard";

describe("the data grid's clipboard text", () => {
	it("quotes only fields that hold a tab, a line break or a quote, doubling inner quotes", () => {
		expect(serializeDataGridClipboardField("plain")).toBe("plain");
		expect(serializeDataGridClipboardField('say "hi"')).toBe('"say ""hi"""');
		expect(serializeDataGridClipboardField("a\tb")).toBe('"a\tb"');
		expect(
			serializeDataGridClipboardText([
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
		expect(parseDataGridClipboardText(serializeDataGridClipboardText(grid))).toEqual(grid);
		expect(parseDataGridClipboardText("a\tb\r\n")).toEqual([["a", "b"]]);
		expect(parseDataGridClipboardText("a\rb\nc")).toEqual([["a"], ["b"], ["c"]]);
		expect(parseDataGridClipboardText("")).toEqual([[""]]);
	});

	it("tiles a copied block over a larger selection, and fills an empty block with blanks", () => {
		expect(tileDataGridClipboardBlock([["1", "2"]], 2, 3)).toEqual([
			["1", "2", "1"],
			["1", "2", "1"],
		]);
		expect(tileDataGridClipboardBlock([], 1, 2)).toEqual([["", ""]]);
		expect(tileDataGridClipboardBlock([[]], 1, 1)).toEqual([[""]]);
	});

	it("writes an escaped HTML table, line breaks as <br>", () => {
		expect(escapeDataGridClipboardHtml("<a & b>")).toBe("&lt;a &amp; b&gt;");
		expect(renderDataGridClipboardHtml([["x<y", "1\n2"]])).toBe("<table><tbody><tr><td>x&lt;y</td><td>1<br>2</td></tr></tbody></table>");
	});
});
