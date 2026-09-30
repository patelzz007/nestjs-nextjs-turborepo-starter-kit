import { describe, expect, it } from "vitest";

import { COLLAPSE_AFTER_LINES, COLLAPSED_LINES, parseProps, presentationFor, serializeProps, type DocsCodeBlockProps } from "./props";

const PROPS: DocsCodeBlockProps = {
	lines: [
		{
			tokens: [{ content: "const", color: "#D73A49", colorDark: "#F97583" }, { content: " x = '</script>';" }],
			number: 1,
			text: "const x = '</script>';",
			state: { highlighted: true },
		},
		{ tokens: [], number: 2, text: "" },
	],
	language: "ts",
	title: "a.ts",
	showLineNumbers: true,
	foldable: true,
	maxLines: null,
};

describe("presentationFor", () => {
	it("numbers and folds real multi-line code", () => {
		expect(presentationFor("ts", 5)).toEqual({ showLineNumbers: true, foldable: true, maxLines: null });
		expect(presentationFor("TS", 1)).toEqual({ showLineNumbers: false, foldable: false, maxLines: null });
	});

	it("keeps shell and text snippets plain", () => {
		expect(presentationFor("bash", 5)).toEqual({ showLineNumbers: false, foldable: false, maxLines: null });
		expect(presentationFor("", 5).showLineNumbers).toBe(false);
	});

	it("collapses long blocks", () => {
		expect(presentationFor("ts", COLLAPSE_AFTER_LINES + 1).maxLines).toBe(COLLAPSED_LINES);
		expect(presentationFor("ts", COLLAPSE_AFTER_LINES).maxLines).toBeNull();
	});
});

describe("props serialisation", () => {
	it("round-trips and never emits a raw `<`", () => {
		const json = serializeProps(PROPS);
		expect(json).not.toContain("<");
		expect(parseProps(json)).toEqual(PROPS);
	});

	it("rejects payloads the build did not produce", () => {
		expect(() => parseProps(JSON.stringify({ ...PROPS, extra: 1 }))).toThrow();
		expect(() => parseProps(JSON.stringify({ ...PROPS, lines: [{ tokens: [], number: "1", text: "" }] }))).toThrow();
		expect(() => parseProps("not json")).toThrow();
	});
});
