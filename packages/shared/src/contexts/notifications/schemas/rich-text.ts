import { z } from "zod";

import type { DataValue } from "../../../schemas/api/common";

// ── Broadcast rich text (ADR 073): ProseMirror / Tiptap JSON with an allowlist ───────────────────
// A broadcast body is stored as the editor's JSON, never as HTML. Only the nodes and marks below are
// accepted; anything else is REJECTED (a 422 naming the path), never silently dropped. The server
// renders it to email HTML, plain text for push and the in-app view.

/** Table limits: at most this many columns and rows, one header row, no merged cells. */
export const RICH_TEXT_MAX_TABLE_COLUMNS = 6;
export const RICH_TEXT_MAX_TABLE_ROWS = 50;
/** A broadcast carries at most one image and one call-to-action button. */
export const RICH_TEXT_MAX_IMAGES = 1;
export const RICH_TEXT_MAX_CALLS_TO_ACTION = 1;
/** Characters of text a whole document may hold. */
export const RICH_TEXT_MAX_TEXT_LENGTH = 20_000;
export const RICH_TEXT_LINK_MAX_LENGTH = 2_048;
const CTA_LABEL_MAX_LENGTH = 40;
const IMAGE_ALT_MAX_LENGTH = 200;
const CODE_LANGUAGE_MAX_LENGTH = 32;

/** Only https links: never `javascript:`, `data:`, `http:` or a relative path. */
export const HttpsLinkSchema = z
	.string()
	.max(RICH_TEXT_LINK_MAX_LENGTH)
	.refine((value: string): boolean => URL.canParse(value) && new URL(value).protocol === "https:", { message: "Links must be absolute https:// URLs" });

/**
 * An object schema closed (`.strict()`: an unknown key is rejected) for what a client SENDS, or open (an
 * unknown key is stripped) for what the API ANSWERS — responses never close their schemas (ADR 022), so
 * a later additive field cannot break an older client. Both come from the same shape.
 */
type Closure = "request" | "response";

function richNode<TShape extends z.ZodRawShape>(closure: Closure, shape: TShape): z.ZodObject<TShape> {
	const node = z.object(shape);
	return closure === "request" ? node.strict() : node;
}

function richTextMarkSchema(closure: Closure): z.ZodType<RichTextMark> {
	return z.discriminatedUnion("type", [
		richNode(closure, { type: z.literal("bold") }),
		richNode(closure, { type: z.literal("italic") }),
		richNode(closure, { type: z.literal("underline") }),
		richNode(closure, { type: z.literal("strike") }),
		richNode(closure, { type: z.literal("code") }),
		richNode(closure, { type: z.literal("link"), attrs: z.object({ href: HttpsLinkSchema }) }),
	]);
}

export const RichTextMarkSchema: z.ZodType<RichTextMark> = richTextMarkSchema("request");

/** Every node is plain JSON (the API response contract's `DataValue`). */
export type RichTextJsonObject = Readonly<Record<string, DataValue | undefined>>;

/** Bold, italic, underline, strikethrough and inline code: a mark with no attributes. */
export interface RichTextPlainMark extends RichTextJsonObject {
	readonly type: "bold" | "italic" | "underline" | "strike" | "code";
}

export interface RichTextLinkMark extends RichTextJsonObject {
	readonly type: "link";
	readonly attrs: { readonly href: string };
}

export type RichTextMark = RichTextPlainMark | RichTextLinkMark;

export interface RichTextText extends RichTextJsonObject {
	readonly type: "text";
	readonly text: string;
	readonly marks?: readonly RichTextMark[] | undefined;
}

export interface RichTextHardBreak extends RichTextJsonObject {
	readonly type: "hardBreak";
}

export type RichTextInline = RichTextText | RichTextHardBreak;

export interface RichTextParagraph extends RichTextJsonObject {
	readonly type: "paragraph";
	readonly content?: readonly RichTextInline[] | undefined;
}

export interface RichTextHeading extends RichTextJsonObject {
	readonly type: "heading";
	readonly attrs: { readonly level: 2 | 3 };
	readonly content?: readonly RichTextInline[] | undefined;
}

export interface RichTextCodeBlock extends RichTextJsonObject {
	readonly type: "codeBlock";
	readonly attrs?: { readonly language?: string | null | undefined } | undefined;
	readonly content?: readonly RichTextText[] | undefined;
}

export interface RichTextListItem extends RichTextJsonObject {
	readonly type: "listItem";
	readonly content: readonly RichTextBlock[];
}

export interface RichTextBulletList extends RichTextJsonObject {
	readonly type: "bulletList";
	readonly content: readonly RichTextListItem[];
}

export interface RichTextOrderedList extends RichTextJsonObject {
	readonly type: "orderedList";
	readonly attrs?: { readonly start?: number | undefined } | undefined;
	readonly content: readonly RichTextListItem[];
}

export interface RichTextBlockquote extends RichTextJsonObject {
	readonly type: "blockquote";
	readonly content: readonly RichTextBlock[];
}

export interface RichTextHorizontalRule extends RichTextJsonObject {
	readonly type: "horizontalRule";
}

export interface RichTextImage extends RichTextJsonObject {
	readonly type: "image";
	/**
	 * A scanned file from the files context, never an external URL. `src` is filled by the SERVER in what it
	 * answers (the file's public address); a request carrying one is refused, so no one can point a broadcast
	 * at an outside image.
	 */
	readonly attrs: { readonly fileId: string; readonly alt: string; readonly src?: string | undefined };
}

export interface RichTextCallToAction extends RichTextJsonObject {
	readonly type: "callToAction";
	readonly attrs: { readonly label: string; readonly href: string };
}

export interface RichTextTableCell extends RichTextJsonObject {
	readonly type: "tableCell" | "tableHeader";
	readonly attrs?: { readonly colspan?: 1 | undefined; readonly rowspan?: 1 | undefined } | undefined;
	readonly content: readonly RichTextParagraph[];
}

export interface RichTextTableRow extends RichTextJsonObject {
	readonly type: "tableRow";
	readonly content: readonly RichTextTableCell[];
}

export interface RichTextTable extends RichTextJsonObject {
	readonly type: "table";
	readonly content: readonly RichTextTableRow[];
}

export type RichTextBlock =
	| RichTextParagraph
	| RichTextHeading
	| RichTextCodeBlock
	| RichTextBulletList
	| RichTextOrderedList
	| RichTextBlockquote
	| RichTextHorizontalRule
	| RichTextImage
	| RichTextCallToAction
	| RichTextTable;

export interface RichTextDocument extends RichTextJsonObject {
	readonly type: "doc";
	readonly content: readonly RichTextBlock[];
}

/** The block schema of one closure; lists, quotes and tables recurse through it. */
function richTextBlockSchema(closure: Closure): z.ZodType<RichTextBlock> {
	const markSchema = richTextMarkSchema(closure);
	const textSchema: z.ZodType<RichTextText> = richNode(closure, { type: z.literal("text"), text: z.string().min(1), marks: z.array(markSchema).optional() });
	const inlineSchema: z.ZodType<RichTextInline> = z.union([textSchema, richNode(closure, { type: z.literal("hardBreak") })]);
	const paragraphSchema: z.ZodType<RichTextParagraph> = richNode(closure, { type: z.literal("paragraph"), content: z.array(inlineSchema).optional() });
	const headingSchema: z.ZodType<RichTextHeading> = richNode(closure, {
		type: z.literal("heading"),
		attrs: richNode(closure, { level: z.union([z.literal(2), z.literal(3)]) }),
		content: z.array(inlineSchema).optional(),
	});
	const codeBlockSchema: z.ZodType<RichTextCodeBlock> = richNode(closure, {
		type: z.literal("codeBlock"),
		attrs: richNode(closure, { language: z.string().max(CODE_LANGUAGE_MAX_LENGTH).nullable().optional() }).optional(),
		content: z.array(textSchema).optional(),
	});
	const imageSchema: z.ZodType<RichTextImage> = richNode(closure, {
		type: z.literal("image"),
		attrs:
			closure === "request"
				? richNode(closure, { fileId: z.uuid(), alt: z.string().max(IMAGE_ALT_MAX_LENGTH) })
				: richNode(closure, { fileId: z.uuid(), alt: z.string().max(IMAGE_ALT_MAX_LENGTH), src: z.url({ protocol: /^https?$/u }).optional() }),
	});
	const callToActionSchema: z.ZodType<RichTextCallToAction> = richNode(closure, {
		type: z.literal("callToAction"),
		attrs: richNode(closure, { label: z.string().trim().min(1).max(CTA_LABEL_MAX_LENGTH), href: HttpsLinkSchema }),
	});
	const tableCellSchema: z.ZodType<RichTextTableCell> = richNode(closure, {
		type: z.enum(["tableCell", "tableHeader"]),
		// Tiptap writes `colwidth` and friends here: kept out of storage rather than rejected.
		attrs: z.object({ colspan: z.literal(1).optional(), rowspan: z.literal(1).optional() }).optional(),
		content: z.array(paragraphSchema),
	});
	const tableRowSchema: z.ZodType<RichTextTableRow> = richNode(closure, {
		type: z.literal("tableRow"),
		content: z.array(tableCellSchema).min(1).max(RICH_TEXT_MAX_TABLE_COLUMNS),
	});
	const tableSchema: z.ZodType<RichTextTable> = richNode(closure, { type: z.literal("table"), content: z.array(tableRowSchema).min(1).max(RICH_TEXT_MAX_TABLE_ROWS) });

	const blockSchema: z.ZodType<RichTextBlock> = z.lazy((): z.ZodType<RichTextBlock> =>
		z.union([
			paragraphSchema,
			headingSchema,
			codeBlockSchema,
			bulletListSchema,
			orderedListSchema,
			blockquoteSchema,
			richNode(closure, { type: z.literal("horizontalRule") }),
			imageSchema,
			callToActionSchema,
			tableSchema,
		]),
	);
	const listItemSchema: z.ZodType<RichTextListItem> = richNode(closure, { type: z.literal("listItem"), content: z.array(blockSchema).min(1) });
	const bulletListSchema: z.ZodType<RichTextBulletList> = richNode(closure, { type: z.literal("bulletList"), content: z.array(listItemSchema).min(1) });
	const orderedListSchema: z.ZodType<RichTextOrderedList> = richNode(closure, {
		type: z.literal("orderedList"),
		attrs: z.object({ start: z.number().int().positive().optional() }).optional(),
		content: z.array(listItemSchema).min(1),
	});
	const blockquoteSchema: z.ZodType<RichTextBlockquote> = richNode(closure, { type: z.literal("blockquote"), content: z.array(blockSchema).min(1) });
	return blockSchema;
}

/** Every block of a document, depth first (lists, quotes and tables included). */
export function richTextBlocks(blocks: readonly RichTextBlock[]): RichTextBlock[] {
	return blocks.flatMap((block: RichTextBlock): RichTextBlock[] => {
		switch (block.type) {
			case "bulletList":
			case "orderedList":
				return [block, ...block.content.flatMap((item: RichTextListItem): RichTextBlock[] => richTextBlocks(item.content))];
			case "blockquote":
				return [block, ...richTextBlocks(block.content)];
			case "table":
				return [block, ...block.content.flatMap((row) => row.content.flatMap((cell) => richTextBlocks(cell.content)))];
			case "paragraph":
			case "heading":
			case "codeBlock":
			case "horizontalRule":
			case "image":
			case "callToAction":
				return [block];
		}
	});
}

/** The inline content of a block that holds text directly. */
export function richTextInlines(block: RichTextBlock): readonly RichTextInline[] {
	switch (block.type) {
		case "paragraph":
		case "heading":
			return block.content ?? [];
		case "codeBlock":
			return block.content ?? [];
		case "bulletList":
		case "orderedList":
		case "blockquote":
		case "horizontalRule":
		case "image":
		case "callToAction":
		case "table":
			return [];
	}
}

/** Every https link in a document: link marks and call-to-action buttons (checked on save and on send). */
export function richTextLinks(document: RichTextDocument): string[] {
	return richTextBlocks(document.content).flatMap((block: RichTextBlock): string[] => [
		...(block.type === "callToAction" ? [block.attrs.href] : []),
		...richTextInlines(block).flatMap((inline: RichTextInline): string[] =>
			inline.type === "text" ? (inline.marks ?? []).flatMap((mark: RichTextMark): string[] => (mark.type === "link" ? [mark.attrs.href] : [])) : [],
		),
	]);
}

/** The plain text of a document, in reading order. */
export function richTextPlainLength(document: RichTextDocument): number {
	return richTextBlocks(document.content).reduce(
		(total: number, block: RichTextBlock): number =>
			total + richTextInlines(block).reduce((sum: number, inline: RichTextInline): number => sum + (inline.type === "text" ? inline.text.length : 0), 0),
		0,
	);
}

/** The validated document: structure, then counts (one image, one CTA, one header row per table, text length). */
export const RichTextDocumentSchema: z.ZodType<RichTextDocument> = richNode("request", {
	type: z.literal("doc"),
	content: z.array(richTextBlockSchema("request")).min(1),
}).superRefine((document: RichTextDocument, context: z.RefinementCtx): void => {
	const blocks = richTextBlocks(document.content);
	if (blocks.filter((block: RichTextBlock): boolean => block.type === "image").length > RICH_TEXT_MAX_IMAGES) {
		context.addIssue({ code: "custom", message: `A broadcast holds at most ${String(RICH_TEXT_MAX_IMAGES)} image`, path: ["content"] });
	}
	if (blocks.filter((block: RichTextBlock): boolean => block.type === "callToAction").length > RICH_TEXT_MAX_CALLS_TO_ACTION) {
		context.addIssue({ code: "custom", message: `A broadcast holds at most ${String(RICH_TEXT_MAX_CALLS_TO_ACTION)} button`, path: ["content"] });
	}
	for (const block of blocks) {
		if (block.type !== "table") {
			continue;
		}
		const [header, ...rest] = block.content;
		const headerRows = [header, ...rest].filter((row): boolean => row?.content.every((cell: RichTextTableCell): boolean => cell.type === "tableHeader") === true);
		const bodyHasHeaderCells = rest.some((row: RichTextTableRow): boolean => row.content.some((cell: RichTextTableCell): boolean => cell.type === "tableHeader"));
		if (headerRows.length > 1 || bodyHasHeaderCells) {
			context.addIssue({ code: "custom", message: "A table has at most one header row, and only as its first row", path: ["content"] });
		}
	}
	if (richTextPlainLength(document) > RICH_TEXT_MAX_TEXT_LENGTH) {
		context.addIssue({ code: "custom", message: `A broadcast holds at most ${String(RICH_TEXT_MAX_TEXT_LENGTH)} characters`, path: ["content"] });
	}
});

/**
 * A stored document as the API answers it: the same structure, open (unknown keys stripped, ADR 022). It
 * passed {@link RichTextDocumentSchema} when it was saved, so the counting rules are not run again.
 */
export const RichTextDocumentResponseSchema: z.ZodType<RichTextDocument> = richNode("response", {
	type: z.literal("doc"),
	content: z.array(richTextBlockSchema("response")).min(1),
});
