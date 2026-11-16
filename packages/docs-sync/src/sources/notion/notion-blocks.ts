import { assetLink, PAGE_TITLE_TOKEN, pageLink, type SourceAsset, type SourceBody } from "@workspace/docs-content/document";
import type { DocsSyncIssue } from "@workspace/shared";

import { withoutNotionStyle } from "./notion-diagram-style.ts";
import { inlineMarkdown, normalisePageId, plainText } from "./notion-rich-text.ts";
import type { NotionBlock, NotionBlockTree, NotionFile, RichText } from "./notion-schemas.ts";

/**
 * Notion blocks → Markdown, the versioned support matrix (plan §6, "Block support"). Bump
 * `NOTION_CONVERTER_VERSION` whenever the output for any block changes: every page is then rebuilt. A block
 * this file does not know holds the page back with a message; nothing is silently dropped.
 */

/** 2: a mermaid block loses its Notion style block (`notion-diagram-style.ts`). */
export const NOTION_CONVERTER_VERSION = 2;

const INDENT = "  ";
const QUOTE_PREFIX = "> ";
const FILE_TYPE_HOSTED = "file";
const FILE_TYPE_EXTERNAL = "external";
const HTTPS_PREFIX = "https://";

/** A callout's icon picks its kind; a callout with any other icon is a note. */
const CALLOUT_KINDS: Readonly<Record<string, string>> = {
	ℹ️: "INFO",
	"⚠️": "WARNING",
	"⛔": "DANGER",
	"✅": "TIP",
};
const DEFAULT_CALLOUT_KIND = "NOTE";

/** Notion's language names that differ from the highlighter's. */
const CODE_LANGUAGES: Readonly<Record<string, string>> = {
	"plain text": "text",
	shell: "bash",
	"c++": "cpp",
	"c#": "csharp",
	"java/c/c++/c#": "java",
};

/** Why each unsupported block is held back, and what the writer can do. */
const UNSUPPORTED_FIXES: Readonly<Record<string, string>> = {
	column_list: "Stack the columns one after another.",
	synced_block: "Replace the synced block with plain content.",
	child_page: "Make it its own page in the Published database, and link to it.",
	child_database: "Replace the database with a table.",
	link_to_database: "Replace the database with a table.",
	embed: "Replace the embed with a link.",
	video: "Link to the video instead.",
	audio: "Link to the audio instead.",
	file: "Link to the file instead.",
	pdf: "Link to the PDF instead.",
	equation: "Replace the equation with an image or text: the site does not draw maths yet.",
	breadcrumb: "Remove the breadcrumb: the site draws its own.",
	table_of_contents: "Remove it: the site draws its own table of contents.",
};
const DEFAULT_UNSUPPORTED_FIX = "Replace this block with text, a list, a table or an image.";

class Conversion {
	public readonly assets: SourceAsset[] = [];
	public readonly links: string[] = [];
	public readonly issues: DocsSyncIssue[] = [];

	/** Blocks as Markdown. Consecutive list items stay together; other blocks are separated by a blank line. */
	public blocks(trees: readonly NotionBlockTree[]): string {
		const parts: string[] = [];
		let number = 0;
		let previousType: string | null = null;
		for (const tree of trees) {
			const { type } = tree.block;
			number = type === "numbered_list_item" ? number + 1 : 0;
			const text = this.block(tree, number);
			if (text === null) {
				continue;
			}
			const tight = isListItem(type) && previousType === type;
			parts.push(tight ? `\n${text}` : `${parts.length === 0 ? "" : "\n\n"}${text}`);
			previousType = type;
		}
		return parts.join("");
	}

	private block(tree: NotionBlockTree, number: number): string | null {
		const { block, children } = tree;
		switch (block.type) {
			case "paragraph":
				return this.textWithChildren(block, block.paragraph?.rich_text, children);
			case "heading_1":
				return this.heading(block, block.heading_1?.rich_text, 1, block.heading_1?.is_toggleable);
			case "heading_2":
				return this.heading(block, block.heading_2?.rich_text, 2, block.heading_2?.is_toggleable);
			case "heading_3":
				return this.heading(block, block.heading_3?.rich_text, 3, block.heading_3?.is_toggleable);
			case "heading_4":
				return this.heading(block, block.heading_4?.rich_text, 4, block.heading_4?.is_toggleable);
			case "bulleted_list_item":
				return this.listItem(block, "- ", block.bulleted_list_item?.rich_text, children);
			case "numbered_list_item":
				return this.listItem(block, `${String(number)}. `, block.numbered_list_item?.rich_text, children);
			case "to_do":
				return this.listItem(block, block.to_do?.checked === true ? "- [x] " : "- [ ] ", block.to_do?.rich_text, children);
			case "quote":
				return this.quoted(this.withChildren(this.inline(block, block.quote?.rich_text), children));
			case "callout":
				return this.callout(block, children);
			case "toggle":
				return this.toggle(block, children);
			case "code":
				return this.code(block);
			case "divider":
				return "---";
			case "table":
				return this.table(block, children);
			case "image":
				return this.image(block);
			case "bookmark":
				return this.bookmark(block);
			case "link_to_page":
				return this.linkToPage(block);
			default:
				return this.unsupported(block);
		}
	}

	private inline(block: NotionBlock, items: readonly RichText[] | undefined): string {
		const result = inlineMarkdown(items ?? []);
		this.links.push(...result.links);
		if (result.hasEquation) {
			this.issues.push({ blockId: block.id, blockType: "equation", reason: "This text holds an equation.", fix: UNSUPPORTED_FIXES.equation ?? DEFAULT_UNSUPPORTED_FIX });
		}
		return result.markdown;
	}

	private withChildren(text: string, children: readonly NotionBlockTree[]): string {
		const nested = this.blocks(children);
		if (nested.length === 0) {
			return text;
		}
		return text.length === 0 ? nested : `${text}\n\n${nested}`;
	}

	private textWithChildren(block: NotionBlock, items: readonly RichText[] | undefined, children: readonly NotionBlockTree[]): string | null {
		const text = this.withChildren(this.inline(block, items), children);
		return text.length === 0 ? null : text;
	}

	private heading(block: NotionBlock, items: readonly RichText[] | undefined, level: number, isToggleable: boolean | undefined): string {
		if (isToggleable === true) {
			this.issues.push({
				blockId: block.id,
				blockType: block.type,
				reason: "This heading is a toggle.",
				fix: "Turn off the toggle, or put a toggle block under a plain heading.",
			});
		}
		return `${"#".repeat(level)} ${this.inline(block, items)}`;
	}

	private listItem(block: NotionBlock, marker: string, items: readonly RichText[] | undefined, children: readonly NotionBlockTree[]): string {
		const text = this.inline(block, items);
		const nested = this.blocks(children);
		const pad = " ".repeat(marker.startsWith("- [") ? INDENT.length : marker.length);
		return nested.length === 0 ? `${marker}${text}` : `${marker}${text}\n\n${indented(nested, pad)}`;
	}

	private quoted(text: string): string {
		return text
			.split("\n")
			.map((line) => (line.length === 0 ? ">" : `${QUOTE_PREFIX}${line}`))
			.join("\n");
	}

	private callout(block: NotionBlock, children: readonly NotionBlockTree[]): string {
		const emoji = block.callout?.icon?.emoji ?? "";
		const kind = CALLOUT_KINDS[emoji] ?? DEFAULT_CALLOUT_KIND;
		return this.quoted(`[!${kind}]\n${this.withChildren(this.inline(block, block.callout?.rich_text), children)}`);
	}

	private toggle(block: NotionBlock, children: readonly NotionBlockTree[]): string {
		return `<details>\n<summary>${this.inline(block, block.toggle?.rich_text)}</summary>\n\n${this.blocks(children)}\n\n</details>`;
	}

	private code(block: NotionBlock): string {
		const language = (block.code?.language ?? "").toLowerCase();
		const fenceLanguage = CODE_LANGUAGES[language] ?? language;
		const text = plainText(block.code?.rich_text ?? []);
		// Notion's colours for a flowchart are not the page's: the site colours diagrams itself.
		const source = fenceLanguage === "mermaid" ? withoutNotionStyle(text) : text;
		const title = plainText(block.code?.caption ?? []).replaceAll('"', "'");
		const longestRun = Math.max(0, ...(source.match(/`+/gu) ?? []).map((run) => run.length));
		const fence = "`".repeat(Math.max(MIN_FENCE_LENGTH, longestRun + 1));
		return `${fence}${fenceLanguage}${title.length === 0 ? "" : ` title="${title}"`}\n${source}\n${fence}`;
	}

	private table(block: NotionBlock, children: readonly NotionBlockTree[]): string {
		const width = block.table?.table_width ?? 0;
		const rows = children.map((child) => (child.block.table_row?.cells ?? []).map((cell) => this.inline(child.block, cell).replace(/\n/gu, " ")));
		const padded = rows.map((row) => Array.from({ length: width }, (_cell, index) => row[index] ?? ""));
		const [header = Array.from({ length: width }, () => ""), ...body] = padded;
		const line = (cells: readonly string[]): string => `| ${cells.join(" | ")} |`;
		return [line(header), line(header.map(() => "---")), ...body.map(line)].join("\n");
	}

	private image(block: NotionBlock): string | null {
		const { image } = block;
		if (image === undefined) {
			return this.unsupported(block);
		}
		const alt = plainText(image.caption ?? []).replace(/[[\]]/gu, "");
		const target = this.imageTarget(block, image);
		return target === null ? null : `![${alt}](${target})`;
	}

	private imageTarget(block: NotionBlock, image: NotionFile): string | null {
		if (image.type === FILE_TYPE_HOSTED && image.file !== undefined) {
			this.assets.push({ assetKey: block.id, url: image.file.url });
			return assetLink(block.id);
		}
		if (image.type === FILE_TYPE_EXTERNAL && image.external?.url.startsWith(HTTPS_PREFIX) === true) {
			return image.external.url;
		}
		this.issues.push({ blockId: block.id, blockType: block.type, reason: "This image is not a file or an https link.", fix: "Upload the image again." });
		return null;
	}

	private bookmark(block: NotionBlock): string | null {
		const { bookmark } = block;
		if (bookmark === undefined) {
			return this.unsupported(block);
		}
		const caption = plainText(bookmark.caption ?? []);
		return `[${caption.length === 0 ? bookmark.url : caption}](${bookmark.url})`;
	}

	private linkToPage(block: NotionBlock): string | null {
		const pageId = block.link_to_page?.page_id;
		if (pageId === undefined) {
			return this.unsupported(block);
		}
		const id = normalisePageId(pageId);
		this.links.push(id);
		return `[${PAGE_TITLE_TOKEN}](${pageLink(id)})`;
	}

	private unsupported(block: NotionBlock): null {
		this.issues.push({
			blockId: block.id,
			blockType: block.type,
			reason: `A ${block.type.replaceAll("_", " ")} block cannot be published yet.`,
			fix: UNSUPPORTED_FIXES[block.type] ?? DEFAULT_UNSUPPORTED_FIX,
		});
		return null;
	}
}

const MIN_FENCE_LENGTH = 3;

function isListItem(type: string): boolean {
	return type === "bulleted_list_item" || type === "numbered_list_item" || type === "to_do";
}

function indented(text: string, pad: string): string {
	return text
		.split("\n")
		.map((line) => (line.length === 0 ? line : `${pad}${line}`))
		.join("\n");
}

/** A page's blocks as a source body. */
export function convertBlocks(trees: readonly NotionBlockTree[]): SourceBody {
	const conversion = new Conversion();
	const markdown = conversion.blocks(trees);
	return { markdown, assets: conversion.assets, links: [...new Set(conversion.links)], issues: conversion.issues };
}
