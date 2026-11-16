import type { BlockContent, Code, DefinitionContent, Heading, Link, List, ListItem, PhrasingContent, Root, RootContent, Table } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { withNotionStyle } from "../notion-diagram-style.ts";

/**
 * Repository Markdown → Notion blocks, for the one-time import (plan §15, phase 2). It is the reverse of
 * `notion-blocks.ts`. A construct Notion has no block for is imported as plain text and listed in `reviews`: the
 * import is reviewed by comparing a full sync with today's pages, so nothing is lost quietly.
 */

export interface NotionRichTextInput {
	readonly type: "text";
	readonly text: { readonly content: string; readonly link?: { readonly url: string } };
	readonly annotations?: { readonly bold?: boolean; readonly italic?: boolean; readonly strikethrough?: boolean; readonly code?: boolean };
}

/** A block to create. `children` are appended after their parent exists, so nesting can be any depth. */
export interface NotionBlockInput {
	readonly type: string;
	readonly content: Readonly<Record<string, object | string | number | boolean | null>>;
	readonly children: readonly NotionBlockInput[];
	/** A repository image still to upload; the importer fills in the block. */
	readonly localImage?: string;
}

export interface ConversionContext {
	/** The address a link should have in Notion, or null when it has no address there. */
	readonly linkTarget: (url: string) => string | null;
}

export interface ConvertedMarkdown {
	readonly blocks: readonly NotionBlockInput[];
	/** What a person should check after the import. */
	readonly reviews: readonly string[];
}

/** Notion's limit on one rich text object. */
const RICH_TEXT_MAX_LENGTH = 2000;
const EXTERNAL_URL_PREFIX = "https://";

/**
 * Languages Notion has under the same name as the fence (its code block's language list). A fence named any of these
 * keeps its language; `NOTION_LANGUAGES` covers the names that differ.
 */
const SAME_NAME_LANGUAGES: ReadonlySet<string> = new Set([
	"bash",
	"c",
	"clojure",
	"css",
	"dart",
	"diff",
	"docker",
	"elixir",
	"go",
	"graphql",
	"groovy",
	"haskell",
	"html",
	"java",
	"javascript",
	"json",
	"kotlin",
	"lua",
	"makefile",
	"markdown",
	"mermaid",
	"php",
	"powershell",
	"python",
	"ruby",
	"rust",
	"scala",
	"scss",
	"shell",
	"sql",
	"swift",
	"typescript",
	"xml",
	"yaml",
]);

/** Fence languages the highlighter and Notion name differently. */
const NOTION_LANGUAGES: Readonly<Record<string, string>> = {
	ts: "typescript",
	tsx: "typescript",
	js: "javascript",
	jsx: "javascript",
	sh: "shell",
	bash: "bash",
	shell: "shell",
	zsh: "shell",
	yml: "yaml",
	yaml: "yaml",
	json: "json",
	jsonc: "json",
	sql: "sql",
	html: "html",
	css: "css",
	python: "python",
	py: "python",
	go: "go",
	rust: "rust",
	mermaid: "mermaid",
	markdown: "markdown",
	md: "markdown",
	prisma: "plain text",
	text: "plain text",
	txt: "plain text",
	"": "plain text",
};

const CALLOUT_ICONS: Readonly<Record<string, string>> = {
	NOTE: "💡",
	INFO: "ℹ️",
	TIP: "✅",
	SUCCESS: "✅",
	WARNING: "⚠️",
	CAUTION: "⚠️",
	IMPORTANT: "⚠️",
	ERROR: "⛔",
	DANGER: "⛔",
};
const CALLOUT_MARKER_PATTERN = /^\[!(?<kind>[A-Z]+)\]\s*/u;

const MAILTO_PREFIX = "mailto:";

/** An email address written bare, which GitHub-flavoured Markdown turns into a link to itself. */
function isAutolinkedEmail(node: Link): boolean {
	const [only, ...rest] = node.children;
	return rest.length === 0 && only?.type === "text" && node.url === `${MAILTO_PREFIX}${only.value}`;
}

function chunks(text: string): readonly string[] {
	const parts: string[] = [];
	for (let start = 0; start < text.length; start += RICH_TEXT_MAX_LENGTH) {
		parts.push(text.slice(start, start + RICH_TEXT_MAX_LENGTH));
	}
	return parts;
}

type Annotations = NonNullable<NotionRichTextInput["annotations"]>;

class Conversion {
	public readonly reviews: string[] = [];
	private readonly _context: ConversionContext;

	public constructor(context: ConversionContext) {
		this._context = context;
	}

	public blocks(nodes: readonly RootContent[]): readonly NotionBlockInput[] {
		return nodes.flatMap((node) => this.block(node));
	}

	private block(node: RootContent): readonly NotionBlockInput[] {
		switch (node.type) {
			case "heading":
				return [this.heading(node)];
			case "paragraph":
				return this.paragraph(node.children);
			case "list":
				return this.list(node);
			case "blockquote":
				return [this.quote(node.children)];
			case "code":
				return [this.code(node)];
			case "table":
				return [this.table(node)];
			case "thematicBreak":
				return [{ type: "divider", content: {}, children: [] }];
			case "html":
				this.reviews.push(`Raw HTML kept as text: ${node.value.slice(0, 60)}`);
				return [this.textBlock("paragraph", [{ type: "text", text: { content: node.value } }])];
			default:
				this.reviews.push(`A ${node.type} node has no Notion block.`);
				return [];
		}
	}

	private textBlock(
		type: string,
		richText: readonly NotionRichTextInput[],
		extra: NotionBlockInput["content"] = {},
		children: readonly NotionBlockInput[] = [],
	): NotionBlockInput {
		return { type, content: { rich_text: richText, ...extra }, children };
	}

	private heading(node: Heading): NotionBlockInput {
		const level = Math.min(node.depth, MAX_NOTION_HEADING);
		return this.textBlock(`heading_${String(level)}`, this.richText(node.children));
	}

	/** An image alone on its line is a block of its own; one inside a sentence cannot stay there. */
	private paragraph(children: readonly PhrasingContent[]): readonly NotionBlockInput[] {
		const images = children.flatMap((child) => (child.type === "image" ? [child] : []));
		const words = children.filter((child) => child.type !== "image");
		const blocks = images.map((image): NotionBlockInput => this.image(image.url, image.alt ?? ""));
		const hasWords = words.some((child) => child.type !== "text" || child.value.trim().length > 0);
		return hasWords ? [this.textBlock("paragraph", this.richText(words)), ...blocks] : blocks;
	}

	private image(url: string, alt: string): NotionBlockInput {
		const caption = alt.length === 0 ? [] : [{ type: "text", text: { content: alt } }];
		if (url.startsWith(EXTERNAL_URL_PREFIX)) {
			return { type: "image", content: { type: "external", external: { url }, caption }, children: [] };
		}
		return { type: "image", content: { caption }, children: [], localImage: url };
	}

	private list(node: List): readonly NotionBlockInput[] {
		return node.children.map((item) => this.listItem(item, node.ordered === true));
	}

	private listItem(item: ListItem, isOrdered: boolean): NotionBlockInput {
		const [first, ...rest] = item.children;
		const richText = first?.type === "paragraph" ? this.richText(first.children) : [];
		const children = this.blocks(first?.type === "paragraph" ? rest : item.children);
		if (item.checked !== null && item.checked !== undefined) {
			return this.textBlock("to_do", richText, { checked: item.checked }, children);
		}
		return this.textBlock(isOrdered ? "numbered_list_item" : "bulleted_list_item", richText, {}, children);
	}

	private quote(children: readonly (BlockContent | DefinitionContent)[]): NotionBlockInput {
		const [first, ...rest] = children;
		if (first?.type !== "paragraph") {
			return this.textBlock("quote", [], {}, this.blocks(children));
		}
		const [lead] = first.children;
		const marker = lead?.type === "text" ? CALLOUT_MARKER_PATTERN.exec(lead.value) : null;
		if (lead?.type !== "text" || marker === null) {
			return this.textBlock("quote", this.richText(first.children), {}, this.blocks(rest));
		}
		const [markerText = ""] = marker;
		const remaining: PhrasingContent[] = [{ ...lead, value: lead.value.slice(markerText.length) }, ...first.children.slice(1)];
		const emoji = CALLOUT_ICONS[marker.groups?.kind ?? ""] ?? DEFAULT_CALLOUT_ICON;
		return this.textBlock("callout", this.richText(remaining), { icon: { type: "emoji", emoji } }, this.blocks(rest));
	}

	private code(node: Code): NotionBlockInput {
		const fence = node.lang ?? "";
		const name = fence.toLowerCase();
		const language = NOTION_LANGUAGES[name] ?? (SAME_NAME_LANGUAGES.has(name) ? name : undefined);
		if (language === undefined) {
			this.reviews.push(`A "${fence}" fence has no Notion language; it is imported as plain text and needs a tested mapping.`);
		}
		// A flowchart is coloured as the site colours it; the sync takes the colours out again (notion-diagram-style.ts).
		const source = language === "mermaid" ? withNotionStyle(node.value) : node.value;
		const richText = chunks(source).map((part): NotionRichTextInput => ({ type: "text", text: { content: part } }));
		return this.textBlock("code", richText, { language: language ?? "plain text" });
	}

	/**
	 * Notion refuses a table whose rows differ in length. GitHub-flavoured Markdown takes the width from the header
	 * row: a row with fewer cells shows empty ones, and cells past the width are not shown. The same rule here keeps
	 * Notion's table what the repository's page shows; a cell dropped that way is listed for review.
	 */
	private table(node: Table): NotionBlockInput {
		const [header] = node.children;
		const width = header?.children.length ?? 0;
		const rows = node.children.map((row): NotionBlockInput => {
			if (row.children.length > width) {
				this.reviews.push(`A table row has ${String(row.children.length)} cells under a ${String(width)}-column header; the extra cells are not imported.`);
			}
			const cells = Array.from({ length: width }, (_unused, column): readonly NotionRichTextInput[] => {
				const cell = row.children.at(column);
				return cell === undefined ? [] : this.richText(cell.children);
			});
			return { type: "table_row", content: { cells }, children: [] };
		});
		return { type: "table", content: { table_width: width, has_column_header: true, has_row_header: false }, children: rows };
	}

	private richText(nodes: readonly PhrasingContent[], annotations: Annotations = {}, link: string | null = null): readonly NotionRichTextInput[] {
		return nodes.flatMap((node): readonly NotionRichTextInput[] => {
			switch (node.type) {
				case "text":
					return this.text(node.value, annotations, link);
				case "inlineCode":
					return this.text(node.value, { ...annotations, code: true }, link);
				case "strong":
					return this.richText(node.children, { ...annotations, bold: true }, link);
				case "emphasis":
					return this.richText(node.children, { ...annotations, italic: true }, link);
				case "delete":
					return this.richText(node.children, { ...annotations, strikethrough: true }, link);
				case "link":
					// A bare address the Markdown turned into a link stays bare: the site links it again, so nothing is lost.
					return isAutolinkedEmail(node) ? this.richText(node.children, annotations, link) : this.richText(node.children, annotations, this.linkOf(node.url));
				case "break":
					return this.text("\n", annotations, link);
				case "html":
					return this.text(node.value, annotations, link);
				default:
					return [];
			}
		});
	}

	private linkOf(url: string): string | null {
		const target = this._context.linkTarget(url);
		if (target === null) {
			this.reviews.push(`The link ${url} has no address in Notion; its text was kept.`);
		}
		return target;
	}

	private text(value: string, annotations: Annotations, link: string | null): readonly NotionRichTextInput[] {
		return chunks(value).map((content): NotionRichTextInput => ({
			type: "text",
			text: link === null ? { content } : { content, link: { url: link } },
			...(Object.keys(annotations).length === 0 ? {} : { annotations }),
		}));
	}
}

const MAX_NOTION_HEADING = 4;
const DEFAULT_CALLOUT_ICON = "💡";

function withoutPageTitle(tree: Root): readonly RootContent[] {
	const [first, ...rest] = tree.children;
	return first?.type === "heading" && first.depth === 1 ? rest : tree.children;
}

/** A page's Markdown body as Notion blocks. A leading `# Title` is dropped: the page has its own title. */
export function markdownToNotion(markdown: string, context: ConversionContext): ConvertedMarkdown {
	const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown);
	const conversion = new Conversion(context);
	return { blocks: conversion.blocks(withoutPageTitle(tree)), reviews: conversion.reviews };
}
