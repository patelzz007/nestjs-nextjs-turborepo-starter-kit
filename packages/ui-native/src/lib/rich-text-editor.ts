// The native RichTextEditor's model, pure. The editor works on a flat list of blocks: text blocks (a paragraph, a
// heading, a list item, a quote line, a code block) made of marked spans, and atoms (a divider, the one button, and
// anything it does not edit — a table, an image — kept as it was). It reads and writes the broadcast document
// (@workspace/shared `RichTextDocument`, the same JSON the web's Tiptap editor stores), so both editors produce the
// same thing.
//
// A phone has no rich-text field: each text block is a TextInput that reports only its new plain text. `applyTextEdit`
// works out what changed (a common start and end, the middle replaced), keeps the marks of the text around it, and
// gives typed text the marks the cursor carries; a typed line break splits the block.

import type {
	RichTextBlock,
	RichTextCallToAction,
	RichTextDocument,
	RichTextInline,
	RichTextListItem,
	RichTextMark,
	RichTextParagraph,
	RichTextPlainMark,
	RichTextText,
} from "@workspace/shared";

/** The marks a toolbar toggles (a link is applied with its address). */
export type PlainMarkType = RichTextPlainMark["type"];

export const PLAIN_MARK_TYPES: readonly PlainMarkType[] = ["bold", "italic", "underline", "strike", "code"];

/** A run of text with the same marks. */
export interface EditorSpan {
	readonly text: string;
	readonly marks: readonly RichTextMark[];
}

/** What a text block is. */
export type TextBlockKind = "paragraph" | "heading2" | "heading3" | "bullet" | "ordered" | "quote" | "code";

export interface EditorTextBlock {
	readonly id: string;
	readonly kind: TextBlockKind;
	readonly spans: readonly EditorSpan[];
}

export type EditorAtom =
	| { readonly id: string; readonly kind: "rule" }
	| { readonly id: string; readonly kind: "button"; readonly label: string; readonly href: string }
	/** A block the editor shows but does not edit (a table, an image), written back as it was. */
	| { readonly id: string; readonly kind: "kept"; readonly node: RichTextBlock };

export type EditorBlock = EditorTextBlock | EditorAtom;

/** A range of plain text in one block, from `start` up to (not including) `end`. */
export interface TextRange {
	readonly start: number;
	readonly end: number;
}

export function isTextBlock(block: EditorBlock): block is EditorTextBlock {
	return block.kind !== "rule" && block.kind !== "button" && block.kind !== "kept";
}

/** A block's plain text. */
export function blockText(block: EditorTextBlock): string {
	return block.spans.map((span: EditorSpan): string => span.text).join("");
}

/** Whether two mark lists are the same marks (a link with the same address). */
export function sameMarks(first: readonly RichTextMark[], second: readonly RichTextMark[]): boolean {
	const key = (marks: readonly RichTextMark[]): string =>
		marks
			.map((mark: RichTextMark): string => (mark.type === "link" ? `link:${mark.attrs.href}` : mark.type))
			.sort()
			.join("|");
	return key(first) === key(second);
}

/** Spans with empty runs dropped and neighbours with the same marks joined. */
export function normalizeSpans(spans: readonly EditorSpan[]): readonly EditorSpan[] {
	const out: EditorSpan[] = [];
	for (const span of spans) {
		if (span.text === "") {
			continue;
		}
		const last = out.at(-1);
		if (last !== undefined && sameMarks(last.marks, span.marks)) {
			out.splice(-1, 1, { text: last.text + span.text, marks: last.marks });
		} else {
			out.push(span);
		}
	}
	return out;
}

/** The spans split at `offset`: what is before and what is after it. */
export function splitSpans(spans: readonly EditorSpan[], offset: number): { readonly before: readonly EditorSpan[]; readonly after: readonly EditorSpan[] } {
	const before: EditorSpan[] = [];
	const after: EditorSpan[] = [];
	let position = 0;
	for (const span of spans) {
		const end = position + span.text.length;
		if (end <= offset) {
			before.push(span);
		} else if (position >= offset) {
			after.push(span);
		} else {
			before.push({ text: span.text.slice(0, offset - position), marks: span.marks });
			after.push({ text: span.text.slice(offset - position), marks: span.marks });
		}
		position = end;
	}
	return { before, after };
}

/** The marks of the text just before `offset` (or just after it, at the start): what typing there continues. */
export function marksAt(spans: readonly EditorSpan[], offset: number): readonly RichTextMark[] {
	const { before, after } = splitSpans(spans, offset);
	return before.at(-1)?.marks ?? after.at(0)?.marks ?? [];
}

/** Whether every character in `range` carries a mark of `type` (at a cursor: whether the text there does). */
export function rangeHasMark(spans: readonly EditorSpan[], range: TextRange, type: RichTextMark["type"]): boolean {
	if (range.start === range.end) {
		return marksAt(spans, range.start).some((mark: RichTextMark): boolean => mark.type === type);
	}
	const { after } = splitSpans(spans, range.start);
	const { before: inside } = splitSpans(after, range.end - range.start);
	return inside.length > 0 && inside.every((span: EditorSpan): boolean => span.marks.some((mark: RichTextMark): boolean => mark.type === type));
}

/** The spans with `change` applied to every mark list inside `range`. */
export function mapRangeMarks(spans: readonly EditorSpan[], range: TextRange, change: (marks: readonly RichTextMark[]) => readonly RichTextMark[]): readonly EditorSpan[] {
	const { before, after } = splitSpans(spans, range.start);
	const { before: inside, after: rest } = splitSpans(after, range.end - range.start);
	return normalizeSpans([...before, ...inside.map((span: EditorSpan): EditorSpan => ({ text: span.text, marks: change(span.marks) })), ...rest]);
}

/** Adds a mark to a list, replacing one of its type (a link's new address). */
export function withMark(marks: readonly RichTextMark[], mark: RichTextMark): readonly RichTextMark[] {
	return [...marks.filter((candidate: RichTextMark): boolean => candidate.type !== mark.type), mark];
}

export function withoutMark(marks: readonly RichTextMark[], type: RichTextMark["type"]): readonly RichTextMark[] {
	return marks.filter((mark: RichTextMark): boolean => mark.type !== type);
}

/** Turns a plain mark on across `range` — or off, when all of it already has it. */
export function toggleMark(spans: readonly EditorSpan[], range: TextRange, type: PlainMarkType): readonly EditorSpan[] {
	const on = rangeHasMark(spans, range, type);
	return mapRangeMarks(spans, range, (marks: readonly RichTextMark[]): readonly RichTextMark[] => (on ? withoutMark(marks, type) : withMark(marks, { type })));
}

/** The result of typing in a block: its new spans, and the text after any typed line break (a new block each). */
export interface TextEdit {
	readonly spans: readonly EditorSpan[];
	readonly lines: readonly (readonly EditorSpan[])[];
}

/**
 * The spans after a TextInput reported `next` in place of the block's text: the unchanged start and end keep their
 * marks, the typed middle takes `typingMarks` (the cursor's marks, or the toolbar's pending ones). A typed line break
 * ends the block there; what follows it becomes new blocks (`lines`).
 */
export function applyTextEdit(spans: readonly EditorSpan[], next: string, typingMarks: readonly RichTextMark[]): TextEdit {
	const previous = spans.map((span: EditorSpan): string => span.text).join("");
	let start = 0;
	while (start < previous.length && start < next.length && previous.charAt(start) === next.charAt(start)) {
		start += 1;
	}
	let end = 0;
	while (end < previous.length - start && end < next.length - start && previous.charAt(previous.length - 1 - end) === next.charAt(next.length - 1 - end)) {
		end += 1;
	}
	const typed = next.slice(start, next.length - end);
	const { before } = splitSpans(spans, start);
	const { after } = splitSpans(spans, previous.length - end);
	const joined = normalizeSpans([...before, { text: typed, marks: typingMarks }, ...after]);
	if (!next.includes("\n")) {
		return { spans: joined, lines: [] };
	}
	const pieces: (readonly EditorSpan[])[] = [];
	let rest = joined;
	let breakAt = blockTextOf(rest).indexOf("\n");
	while (breakAt >= 0) {
		const { before: head, after: tail } = splitSpans(rest, breakAt);
		pieces.push(head);
		rest = splitSpans(tail, 1).after;
		breakAt = blockTextOf(rest).indexOf("\n");
	}
	pieces.push(rest);
	const [first = [], ...lines] = pieces;
	return { spans: normalizeSpans(first), lines: lines.map(normalizeSpans) };
}

function blockTextOf(spans: readonly EditorSpan[]): string {
	return spans.map((span: EditorSpan): string => span.text).join("");
}

// ── Documents ──────────────────────────────────────────────────────────────

/** Makes block ids: the editor's own, never stored. */
export type BlockIdFactory = () => string;

export function createBlockIdFactory(prefix = "block"): BlockIdFactory {
	let next = 0;
	return (): string => {
		next += 1;
		return `${prefix}-${String(next)}`;
	};
}

function spansOf(content: readonly RichTextInline[] | undefined): readonly EditorSpan[] {
	return normalizeSpans(
		(content ?? []).map((inline: RichTextInline): EditorSpan => (inline.type === "text" ? { text: inline.text, marks: inline.marks ?? [] } : { text: "\n", marks: [] })),
	);
}

/** The text blocks of a list item or quote: its paragraphs (deeper structure is kept as it was). */
function nestedBlocks(content: readonly RichTextBlock[], kind: TextBlockKind, nextId: BlockIdFactory): readonly EditorBlock[] {
	return content.flatMap((block: RichTextBlock): readonly EditorBlock[] =>
		block.type === "paragraph" ? [{ id: nextId(), kind, spans: spansOf(block.content) }] : [{ id: nextId(), kind: "kept", node: block }],
	);
}

/** A stored document as the editor's blocks. */
export function documentToBlocks(document: RichTextDocument | null, nextId: BlockIdFactory): readonly EditorBlock[] {
	const blocks = (document?.content ?? []).flatMap((block: RichTextBlock): readonly EditorBlock[] => {
		switch (block.type) {
			case "paragraph":
				return [{ id: nextId(), kind: "paragraph", spans: spansOf(block.content) }];
			case "heading":
				return [{ id: nextId(), kind: block.attrs.level === 2 ? "heading2" : "heading3", spans: spansOf(block.content) }];
			case "codeBlock":
				return [{ id: nextId(), kind: "code", spans: normalizeSpans((block.content ?? []).map((text: RichTextText): EditorSpan => ({ text: text.text, marks: [] }))) }];
			case "bulletList":
			case "orderedList":
				return block.content.flatMap((item: RichTextListItem): readonly EditorBlock[] =>
					nestedBlocks(item.content, block.type === "bulletList" ? "bullet" : "ordered", nextId),
				);
			case "blockquote":
				return nestedBlocks(block.content, "quote", nextId);
			case "horizontalRule":
				return [{ id: nextId(), kind: "rule" }];
			case "callToAction":
				return [{ id: nextId(), kind: "button", label: block.attrs.label, href: block.attrs.href }];
			// Tables and images are kept as they are: shown, never edited (the web edits them).
			case "image":
			case "table":
				return [{ id: nextId(), kind: "kept", node: block }];
		}
	});
	return blocks.length === 0 ? [{ id: nextId(), kind: "paragraph", spans: [] }] : blocks;
}

function inlineOf(spans: readonly EditorSpan[]): readonly RichTextInline[] {
	return spans.flatMap((span: EditorSpan): readonly RichTextInline[] =>
		span.text.split("\n").flatMap((piece: string, index: number): readonly RichTextInline[] => {
			const text: readonly RichTextInline[] = piece === "" ? [] : [span.marks.length === 0 ? { type: "text", text: piece } : { type: "text", text: piece, marks: span.marks }];
			return index === 0 ? text : [{ type: "hardBreak" }, ...text];
		}),
	);
}

function paragraphOf(spans: readonly EditorSpan[]): RichTextParagraph {
	const content = inlineOf(spans);
	return content.length === 0 ? { type: "paragraph" } : { type: "paragraph", content };
}

/** One stored block for a run of editor blocks of the same list or quote kind. */
function groupOf(kind: TextBlockKind, run: readonly EditorTextBlock[]): RichTextBlock {
	const paragraphs = run.map((block: EditorTextBlock): RichTextParagraph => paragraphOf(block.spans));
	if (kind === "quote") {
		return { type: "blockquote", content: paragraphs };
	}
	const items = paragraphs.map((paragraph: RichTextParagraph): RichTextListItem => ({ type: "listItem", content: [paragraph] }));
	return kind === "bullet" ? { type: "bulletList", content: items } : { type: "orderedList", content: items };
}

function storedBlock(block: EditorBlock): RichTextBlock {
	switch (block.kind) {
		case "rule":
			return { type: "horizontalRule" };
		case "button": {
			const button: RichTextCallToAction = { type: "callToAction", attrs: { label: block.label, href: block.href } };
			return button;
		}
		case "kept":
			return block.node;
		case "heading2":
		case "heading3": {
			const content = inlineOf(block.spans);
			return { type: "heading", attrs: { level: block.kind === "heading2" ? 2 : 3 }, ...(content.length === 0 ? {} : { content }) };
		}
		case "code": {
			const text = blockText(block);
			return text === "" ? { type: "codeBlock" } : { type: "codeBlock", content: [{ type: "text", text }] };
		}
		case "paragraph":
		case "bullet":
		case "ordered":
		case "quote":
			return paragraphOf(block.spans);
	}
}

const GROUPED: readonly TextBlockKind[] = ["bullet", "ordered", "quote"];

/** The editor's blocks as a stored document: list items and quote lines joined into their lists and quotes. */
export function blocksToDocument(blocks: readonly EditorBlock[]): RichTextDocument {
	const content: RichTextBlock[] = [];
	let run: EditorTextBlock[] = [];
	const flush = (): void => {
		const [first] = run;
		if (first !== undefined) {
			content.push(groupOf(first.kind, run));
		}
		run = [];
	};
	for (const block of blocks) {
		if (isTextBlock(block) && GROUPED.includes(block.kind)) {
			const [first] = run;
			if (first !== undefined && first.kind !== block.kind) {
				flush();
			}
			run.push(block);
		} else {
			flush();
			content.push(storedBlock(block));
		}
	}
	flush();
	return { type: "doc", content };
}

// ── History ────────────────────────────────────────────────────────────────

/** The blocks now, with what came before (undo) and after (redo). */
export interface EditorHistory {
	readonly past: readonly (readonly EditorBlock[])[];
	readonly present: readonly EditorBlock[];
	readonly future: readonly (readonly EditorBlock[])[];
}

/** How many steps back Undo keeps. */
export const HISTORY_LIMIT = 100;

export function pushHistory(history: EditorHistory, next: readonly EditorBlock[]): EditorHistory {
	return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}

export function undoHistory(history: EditorHistory): EditorHistory {
	const previous = history.past.at(-1);
	return previous === undefined ? history : { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoHistory(history: EditorHistory): EditorHistory {
	const [next, ...rest] = history.future;
	return next === undefined ? history : { past: [...history.past, history.present], present: next, future: rest };
}
