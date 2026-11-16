import { z } from "zod";

/**
 * Notion's API responses (version `NOTION_API_VERSION`), checked at the boundary. A block is one object with an
 * optional field per block type rather than a closed union: a block type Notion adds later must reach the
 * converter and be held back with a message, not fail the whole run at parsing.
 */

export const NOTION_API_VERSION = "2026-03-11";

const AnnotationsSchema = z.object({
	bold: z.boolean(),
	italic: z.boolean(),
	strikethrough: z.boolean(),
	code: z.boolean(),
});

const MentionSchema = z.object({
	type: z.string(),
	page: z.object({ id: z.string() }).optional(),
	link_preview: z.object({ url: z.string() }).optional(),
});

export const RichTextSchema = z.object({
	type: z.string(),
	plain_text: z.string(),
	href: z.string().nullable().optional(),
	annotations: AnnotationsSchema,
	mention: MentionSchema.optional(),
});
export type RichText = z.output<typeof RichTextSchema>;

const RichTextListSchema = z.array(RichTextSchema);

const TextBlockSchema = z.object({ rich_text: RichTextListSchema });
const HeadingBlockSchema = TextBlockSchema.extend({ is_toggleable: z.boolean().optional() });
const ToDoBlockSchema = TextBlockSchema.extend({ checked: z.boolean() });

const IconSchema = z.object({ type: z.string().optional(), emoji: z.string().optional() }).nullable();
const CalloutBlockSchema = TextBlockSchema.extend({ icon: IconSchema.optional(), color: z.string().optional() });
const CodeBlockSchema = TextBlockSchema.extend({ language: z.string(), caption: RichTextListSchema.optional() });

/** A file as Notion stores it: `file` (a hosted, expiring link), `external` (a link the writer pasted) or `file_upload`. */
export const NotionFileSchema = z.object({
	type: z.string(),
	file: z.object({ url: z.string() }).optional(),
	external: z.object({ url: z.string() }).optional(),
	caption: RichTextListSchema.optional(),
});
export type NotionFile = z.output<typeof NotionFileSchema>;

const BookmarkBlockSchema = z.object({ url: z.string(), caption: RichTextListSchema.optional() });
const LinkToPageBlockSchema = z.object({ type: z.string(), page_id: z.string().optional() });
const TableBlockSchema = z.object({ has_column_header: z.boolean(), table_width: z.number().int().positive() });
const TableRowBlockSchema = z.object({ cells: z.array(RichTextListSchema) });

export const NotionBlockSchema = z.object({
	id: z.string(),
	type: z.string(),
	has_children: z.boolean(),
	paragraph: TextBlockSchema.optional(),
	heading_1: HeadingBlockSchema.optional(),
	heading_2: HeadingBlockSchema.optional(),
	heading_3: HeadingBlockSchema.optional(),
	heading_4: HeadingBlockSchema.optional(),
	bulleted_list_item: TextBlockSchema.optional(),
	numbered_list_item: TextBlockSchema.optional(),
	to_do: ToDoBlockSchema.optional(),
	toggle: TextBlockSchema.optional(),
	quote: TextBlockSchema.optional(),
	callout: CalloutBlockSchema.optional(),
	code: CodeBlockSchema.optional(),
	image: NotionFileSchema.optional(),
	bookmark: BookmarkBlockSchema.optional(),
	link_to_page: LinkToPageBlockSchema.optional(),
	table: TableBlockSchema.optional(),
	table_row: TableRowBlockSchema.optional(),
});
export type NotionBlock = z.output<typeof NotionBlockSchema>;

/** A block with its children fetched. */
export interface NotionBlockTree {
	readonly block: NotionBlock;
	readonly children: readonly NotionBlockTree[];
}

const ListPageFieldsSchema = z.object({ has_more: z.boolean(), next_cursor: z.string().nullable() });

export const BlockListSchema = ListPageFieldsSchema.extend({ results: z.array(NotionBlockSchema) });

const PropertyValueSchema = z.object({
	type: z.string(),
	title: RichTextListSchema.optional(),
	rich_text: RichTextListSchema.optional(),
	select: z.object({ name: z.string() }).nullable().optional(),
	multi_select: z.array(z.object({ name: z.string() })).optional(),
	number: z.number().nullable().optional(),
	date: z.object({ start: z.string() }).nullable().optional(),
	/** The pages a relation points at: a docs page's Parent folder. */
	relation: z.array(z.object({ id: z.string() })).optional(),
});
export type PropertyValue = z.output<typeof PropertyValueSchema>;

export const NotionPageSchema = z.object({
	object: z.literal("page"),
	id: z.string(),
	url: z.url(),
	last_edited_time: z.iso.datetime({ offset: true }),
	cover: NotionFileSchema.nullable(),
	properties: z.record(z.string(), PropertyValueSchema),
});
export type NotionPage = z.output<typeof NotionPageSchema>;

/** A wiki data source can also return data sources; only pages are documents. */
const QueryResultSchema = z.union([NotionPageSchema, z.object({ object: z.literal("data_source") })]);

export const DataSourceQuerySchema = ListPageFieldsSchema.extend({
	results: z.array(QueryResultSchema),
	/** `incomplete` means Notion stopped at its result cap: the list must not be treated as complete. */
	request_status: z.object({ type: z.string() }).optional(),
});

export const NotionErrorSchema = z.object({ code: z.string(), message: z.string() });

export const REQUEST_INCOMPLETE = "incomplete";
