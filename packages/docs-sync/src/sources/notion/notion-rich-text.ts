import { pageLink } from "@workspace/docs-content/document";

import type { RichText } from "./notion-schemas.ts";

/** Rich text → inline Markdown. Everything the text says is escaped, so a writer's `*` stays a `*`. */

export interface InlineResult {
	readonly markdown: string;
	/** The ids of the Notion pages linked from this text. */
	readonly links: readonly string[];
	/** Set when the text holds something the site cannot draw. */
	readonly hasEquation: boolean;
}

const SPECIAL_CHARACTERS = /[\\`*_[\]<>~|]/gu;
const LINE_BREAK = /\n/gu;
const HARD_BREAK = "\\\n";
const PAGE_ID_PATTERN = /(?<id>[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[?#].*)?$/iu;
const NOTION_HOSTS: ReadonlySet<string> = new Set(["www.notion.so", "notion.so", "app.notion.com"]);
const LEADING_SPACE = /^\s*/u;
const TRAILING_SPACE = /\s*$/u;

function escapeText(text: string): string {
	return text.replace(SPECIAL_CHARACTERS, "\\$&").replace(LINE_BREAK, HARD_BREAK);
}

/** A code span long enough to hold any backticks inside it. */
function codeSpan(text: string): string {
	const longest = Math.max(0, ...(text.match(/`+/gu) ?? []).map((run) => run.length));
	const fence = "`".repeat(longest + 1);
	return longest > 0 ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
}

/** Wraps text in a marker, keeping its outer spaces outside: `**word **` is not bold in Markdown. */
function wrap(text: string, marker: string): string {
	const leading = LEADING_SPACE.exec(text)?.at(0) ?? "";
	const trailing = TRAILING_SPACE.exec(text)?.at(0) ?? "";
	const core = text.slice(leading.length, text.length - trailing.length);
	return core.length === 0 ? text : `${leading}${marker}${core}${marker}${trailing}`;
}

/** The Notion page an address points at, as a dashed id; null when it points anywhere else. */
export function notionPageIdOf(href: string): string | null {
	let url: URL | null = null;
	if (href.startsWith("/")) {
		url = new URL(href, "https://www.notion.so");
	} else if (URL.canParse(href)) {
		url = new URL(href);
	}
	if (url === null || !NOTION_HOSTS.has(url.hostname)) {
		return null;
	}
	const id = PAGE_ID_PATTERN.exec(url.pathname)?.groups?.id;
	return id === undefined ? null : normalisePageId(id);
}

const COMPACT_ID_LENGTH = 32;
const ID_GROUPS = /^(?<a>.{8})(?<b>.{4})(?<c>.{4})(?<d>.{4})(?<e>.{12})$/u;

/** Notion writes ids with and without dashes; the API's dashed form is the identity. */
export function normalisePageId(id: string): string {
	const lower = id.toLowerCase();
	return lower.length === COMPACT_ID_LENGTH ? lower.replace(ID_GROUPS, "$<a>-$<b>-$<c>-$<d>-$<e>") : lower;
}

function styled(item: RichText): string {
	const { bold, italic, strikethrough, code } = item.annotations;
	let text = code ? codeSpan(item.plain_text) : escapeText(item.plain_text);
	if (strikethrough) {
		text = wrap(text, "~~");
	}
	if (italic) {
		text = wrap(text, "*");
	}
	return bold ? wrap(text, "**") : text;
}

function piece(item: RichText): { readonly markdown: string; readonly links: readonly string[] } {
	const text = styled(item);
	if (item.mention?.page !== undefined) {
		const id = normalisePageId(item.mention.page.id);
		return { markdown: `[${text}](${pageLink(id)})`, links: [id] };
	}
	const href = item.href ?? item.mention?.link_preview?.url ?? null;
	if (href === null) {
		return { markdown: text, links: [] };
	}
	const pageId = notionPageIdOf(href);
	return pageId === null ? { markdown: `[${text}](${href})`, links: [] } : { markdown: `[${text}](${pageLink(pageId)})`, links: [pageId] };
}

/** A run of rich text as one line of Markdown. */
export function inlineMarkdown(items: readonly RichText[]): InlineResult {
	const pieces = items.map(piece);
	return {
		markdown: pieces.map((item) => item.markdown).join(""),
		links: pieces.flatMap((item) => item.links),
		hasEquation: items.some((item) => item.type === "equation"),
	};
}

/** The words of a run of rich text, with no Markdown. */
export function plainText(items: readonly RichText[]): string {
	return items.map((item) => item.plain_text).join("");
}
