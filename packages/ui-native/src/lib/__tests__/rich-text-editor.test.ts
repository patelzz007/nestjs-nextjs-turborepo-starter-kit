import { RichTextDocumentSchema, type RichTextDocument, type RichTextLinkMark, type RichTextPlainMark } from "@workspace/shared";

import {
	applyTextEdit,
	blocksToDocument,
	blockText,
	createBlockIdFactory,
	documentToBlocks,
	HISTORY_LIMIT,
	isTextBlock,
	mapRangeMarks,
	marksAt,
	normalizeSpans,
	pushHistory,
	rangeHasMark,
	redoHistory,
	sameMarks,
	splitSpans,
	toggleMark,
	undoHistory,
	withMark,
	type EditorBlock,
	type EditorHistory,
	type EditorSpan,
} from "../rich-text-editor";

const BOLD: RichTextPlainMark = { type: "bold" };
const LINK: RichTextLinkMark = { type: "link", attrs: { href: "https://example.com" } };
const SPANS: readonly EditorSpan[] = [
	{ text: "Hello ", marks: [] },
	{ text: "bold", marks: [BOLD] },
	{ text: " world", marks: [] },
];

const DOCUMENT: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
		{
			type: "paragraph",
			content: [{ type: "text", text: "Hi " }, { type: "text", text: "there", marks: [{ type: "italic" }] }, { type: "hardBreak" }, { type: "text", text: "line two" }],
		},
		{
			type: "bulletList",
			content: [
				{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
				{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] },
			],
		},
		{ type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "first" }] }, { type: "horizontalRule" }] }] },
		{ type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "quoted" }] }] },
		{ type: "codeBlock", content: [{ type: "text", text: "const a = 1;" }] },
		{ type: "horizontalRule" },
		{ type: "callToAction", attrs: { label: "Open", href: "https://example.com/open" } },
		{ type: "heading", attrs: { level: 3 } },
		{ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph" }] }] }] },
		{ type: "codeBlock" },
		{ type: "paragraph" },
	],
};

describe("the editor's spans", () => {
	it("compare marks as sets, links by address", () => {
		expect(sameMarks([BOLD, { type: "italic" }], [{ type: "italic" }, BOLD])).toBe(true);
		expect(sameMarks([LINK], [{ type: "link", attrs: { href: "https://other.example" } }])).toBe(false);
	});

	it("drop empty runs and join neighbours with the same marks", () => {
		expect(
			normalizeSpans([
				{ text: "a", marks: [] },
				{ text: "", marks: [BOLD] },
				{ text: "b", marks: [] },
			]),
		).toEqual([{ text: "ab", marks: [] }]);
	});

	it("split at an offset, inside a span or between spans", () => {
		expect(splitSpans(SPANS, 8)).toEqual({
			before: [
				{ text: "Hello ", marks: [] },
				{ text: "bo", marks: [BOLD] },
			],
			after: [
				{ text: "ld", marks: [BOLD] },
				{ text: " world", marks: [] },
			],
		});
		expect(splitSpans(SPANS, 6).after.at(0)).toEqual({ text: "bold", marks: [BOLD] });
	});

	it("carry the marks of the text before the cursor, or after it at the start", () => {
		expect(marksAt(SPANS, 8)).toEqual([BOLD]);
		expect(marksAt([{ text: "x", marks: [BOLD] }], 0)).toEqual([BOLD]);
		expect(marksAt([], 0)).toEqual([]);
	});

	it("know whether a range or the cursor has a mark", () => {
		expect(rangeHasMark(SPANS, { start: 6, end: 10 }, "bold")).toBe(true);
		expect(rangeHasMark(SPANS, { start: 4, end: 10 }, "bold")).toBe(false);
		expect(rangeHasMark(SPANS, { start: 8, end: 8 }, "bold")).toBe(true);
		expect(rangeHasMark([], { start: 0, end: 1 }, "bold")).toBe(false);
	});

	it("toggle a mark on and off across a range, and set a link's address", () => {
		const bolded = toggleMark(SPANS, { start: 0, end: 5 }, "bold");
		expect(bolded.at(0)).toEqual({ text: "Hello", marks: [BOLD] });
		expect(toggleMark(bolded, { start: 0, end: 5 }, "bold")).toEqual(SPANS);
		const linked = mapRangeMarks(SPANS, { start: 0, end: 5 }, (marks) => withMark(marks, LINK));
		expect(linked.at(0)?.marks).toEqual([LINK]);
	});
});

describe("typing", () => {
	it("keeps the marks around an edit and gives typed text the cursor's marks", () => {
		expect(applyTextEdit(SPANS, "Hello boldest world", [BOLD]).spans).toEqual([
			{ text: "Hello ", marks: [] },
			{ text: "boldest", marks: [BOLD] },
			{ text: " world", marks: [] },
		]);
		expect(applyTextEdit(SPANS, "Hello  world", []).spans).toEqual([{ text: "Hello  world", marks: [] }]);
		expect(applyTextEdit([], "new", []).spans).toEqual([{ text: "new", marks: [] }]);
		expect(applyTextEdit(SPANS, "Hello bold world", []).lines).toEqual([]);
	});

	it("ends the block at a typed line break and carries the rest into new blocks", () => {
		const enter = applyTextEdit(SPANS, "Hello bo\nld world", []);
		expect(enter.spans).toEqual([
			{ text: "Hello ", marks: [] },
			{ text: "bo", marks: [BOLD] },
		]);
		expect(enter.lines).toEqual([
			[
				{ text: "ld", marks: [BOLD] },
				{ text: " world", marks: [] },
			],
		]);
		const pasted = applyTextEdit([{ text: "end", marks: [] }], "end one\ntwo\nthree", [BOLD]);
		expect(pasted.spans).toEqual([
			{ text: "end", marks: [] },
			{ text: " one", marks: [BOLD] },
		]);
		expect(pasted.lines).toEqual([[{ text: "two", marks: [BOLD] }], [{ text: "three", marks: [BOLD] }]]);
		expect(applyTextEdit([], "\n", []).lines).toEqual([[]]);
	});
});

describe("documents", () => {
	it("read every block the editor knows and keep the rest", () => {
		const blocks = documentToBlocks(DOCUMENT, createBlockIdFactory("t"));
		expect(blocks.map((block) => block.kind)).toEqual([
			"heading2",
			"paragraph",
			"bullet",
			"bullet",
			"ordered",
			"kept",
			"quote",
			"code",
			"rule",
			"button",
			"heading3",
			"kept",
			"code",
			"paragraph",
		]);
		const [, paragraph] = blocks;
		expect(paragraph !== undefined && isTextBlock(paragraph) ? blockText(paragraph) : "").toBe("Hi there\nline two");
		expect(blocks.at(0)?.id).toBe("t-1");
	});

	it("give an empty document one empty paragraph", () => {
		expect(documentToBlocks(null, createBlockIdFactory())).toEqual([{ id: "block-1", kind: "paragraph", spans: [] }]);
		expect(documentToBlocks({ type: "doc", content: [] }, createBlockIdFactory()).map((block) => block.kind)).toEqual(["paragraph"]);
	});

	it("write back a valid document: lists and quotes grouped, line breaks as hard breaks", () => {
		const blocks = documentToBlocks(DOCUMENT, createBlockIdFactory());
		const document = blocksToDocument(blocks);
		expect(RichTextDocumentSchema.safeParse(document).success).toBe(true);
		expect(document.content.map((block) => block.type)).toEqual([
			"heading",
			"paragraph",
			"bulletList",
			"orderedList",
			"horizontalRule",
			"blockquote",
			"codeBlock",
			"horizontalRule",
			"callToAction",
			"heading",
			"table",
			"codeBlock",
			"paragraph",
		]);
		expect(document.content.at(1)).toEqual(DOCUMENT.content.at(1));
	});

	it("split runs of different list kinds into their own lists", () => {
		const blocks: readonly EditorBlock[] = [
			{ id: "a", kind: "bullet", spans: [{ text: "a", marks: [] }] },
			{ id: "b", kind: "ordered", spans: [{ text: "b", marks: [] }] },
			{ id: "c", kind: "quote", spans: [] },
		];
		expect(blocksToDocument(blocks).content.map((block) => block.type)).toEqual(["bulletList", "orderedList", "blockquote"]);
	});
});

describe("history", () => {
	const one: readonly EditorBlock[] = [{ id: "1", kind: "paragraph", spans: [] }];
	const two: readonly EditorBlock[] = [{ id: "2", kind: "paragraph", spans: [] }];

	it("undoes and redoes, and a new change clears what could be redone", () => {
		const start = { past: [], present: one, future: [] };
		const changed = pushHistory(start, two);
		expect(undoHistory(changed).present).toBe(one);
		expect(redoHistory(undoHistory(changed)).present).toBe(two);
		expect(undoHistory(start)).toBe(start);
		expect(redoHistory(start)).toBe(start);
		expect(pushHistory(undoHistory(changed), two).future).toEqual([]);
	});

	it("keeps a bounded number of steps", () => {
		let history: EditorHistory = { past: [], present: one, future: [] };
		for (let step = 0; step < HISTORY_LIMIT + 5; step += 1) {
			history = pushHistory(history, two);
		}
		expect(history.past.length).toBe(HISTORY_LIMIT);
	});
});
