// ============================================
// lib/markdown.ts - GitHub-flavoured markdown into a small, typed tree
// ============================================
// Pull request descriptions and comments are markdown. `marked`'s lexer reads
// them (GitHub-flavoured: tables, task lists, strikethrough); its output is a
// third-party shape, so it is validated with zod before anything reads it, and
// turned into the app's own tree — only what the app draws. A token the app
// does not know is kept as its raw text, so nothing GitHub sends can break a
// screen. Images become blocks of their own (a picture is drawn at the width
// of the text, never inside a line), written as markdown or as GitHub's
// `<img>` HTML — what GitHub writes for a pasted screenshot. Other HTML that
// only lays images out (`<p align="center">`, `<a>`, `<picture>`) is dropped
// around them; any other HTML stays as written. Pure; `components/markdown.tsx`
// draws the tree.

import { lexer } from "marked";
import { z } from "zod";

/** Inline content: text and its emphasis, code, links, images and line breaks. */
export type MarkdownInline =
	| { readonly kind: "text"; readonly text: string }
	| { readonly kind: "strong"; readonly children: readonly MarkdownInline[] }
	| { readonly kind: "emphasis"; readonly children: readonly MarkdownInline[] }
	| { readonly kind: "strike"; readonly children: readonly MarkdownInline[] }
	| { readonly kind: "code"; readonly text: string }
	| { readonly kind: "link"; readonly href: string; readonly children: readonly MarkdownInline[] }
	| ({ readonly kind: "image" } & MarkdownImage)
	| { readonly kind: "break" };

/** A picture: where it is, its description, and its size when the author gave one (`<img width height>`). */
export interface MarkdownImage {
	readonly href: string;
	readonly alt: string;
	readonly width: number | null;
	readonly height: number | null;
}

export interface MarkdownListItem {
	/** `true` / `false` for a task-list item (`- [x]`), `null` otherwise. */
	readonly checked: boolean | null;
	readonly blocks: readonly MarkdownBlock[];
}

/** Block content: paragraphs, headings, code blocks, quotes, lists, rules and tables. */
export type MarkdownBlock =
	| { readonly kind: "paragraph"; readonly children: readonly MarkdownInline[] }
	| { readonly kind: "heading"; readonly level: number; readonly children: readonly MarkdownInline[] }
	| { readonly kind: "code"; readonly text: string; readonly language: string | null }
	| { readonly kind: "quote"; readonly blocks: readonly MarkdownBlock[] }
	| { readonly kind: "list"; readonly ordered: boolean; readonly start: number; readonly items: readonly MarkdownListItem[] }
	| { readonly kind: "rule" }
	/** A picture, drawn at the text's width; `link` is where a tap goes when the author linked it (a badge). */
	| ({ readonly kind: "image"; readonly link: string | null } & MarkdownImage)
	| { readonly kind: "table"; readonly header: readonly (readonly MarkdownInline[])[]; readonly rows: readonly (readonly (readonly MarkdownInline[])[])[] };

/** The token fields the app reads, validated (`marked` adds more; they are ignored). Nested tokens are validated the same way. */
interface RawToken {
	readonly type: string;
	readonly raw: string;
	readonly text?: string | undefined;
	readonly depth?: number | undefined;
	readonly lang?: string | undefined;
	readonly href?: string | undefined;
	readonly ordered?: boolean | undefined;
	readonly start?: number | "" | undefined;
	readonly task?: boolean | undefined;
	readonly checked?: boolean | undefined;
	readonly tokens?: readonly RawToken[] | undefined;
	readonly items?: readonly RawToken[] | undefined;
	readonly header?: readonly RawTableCell[] | undefined;
	readonly rows?: readonly (readonly RawTableCell[])[] | undefined;
}

interface RawTableCell {
	readonly tokens: readonly RawToken[];
}

const RawTokenSchema: z.ZodType<RawToken> = z.lazy(() =>
	z.object({
		type: z.string(),
		raw: z.string(),
		text: z.string().optional(),
		depth: z.number().int().optional(),
		lang: z.string().optional(),
		href: z.string().optional(),
		ordered: z.boolean().optional(),
		start: z.union([z.number().int(), z.literal("")]).optional(),
		task: z.boolean().optional(),
		checked: z.boolean().optional(),
		tokens: z.array(RawTokenSchema).optional(),
		items: z.array(RawTokenSchema).optional(),
		header: z.array(RawTableCellSchema).optional(),
		rows: z.array(z.array(RawTableCellSchema)).optional(),
	}),
);

const RawTableCellSchema: z.ZodType<RawTableCell> = z.lazy(() => z.object({ tokens: z.array(RawTokenSchema) }));

const RawTokensSchema = z.array(RawTokenSchema);

// ── Images written as HTML ─────────────────────────────────────────────────

/*
 * The global patterns are made fresh for every scan: a scan moves a pattern's
 * `lastIndex`, and the app's Babel build turns a pattern with named groups into
 * a wrapper that alone knows the names — a copy (`new RegExp(…)`, or the one
 * `matchAll` makes inside the engine) loses them, which on a phone left every
 * picture without its address.
 */
function imageTagPattern(): RegExp {
	return /<img\b(?<attributes>[^>]*?)\/?>/giu;
}

function attributePattern(): RegExp {
	return /(?<name>[\w-]+)\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)')/gu;
}
/** Tags that only lay pictures out; dropped when nothing but pictures is inside them. */
const LAYOUT_TAG_PATTERN = /<\/?(?:a|p|div|span|picture|source|center|br)\b[^>]*>/giu;
const LINE_BREAK_TAG_PATTERN = /^<br\s*\/?>$/iu;
const ENTITY_PATTERN = /&(?<entity>amp|quot|lt|gt|#39|#x27);/gu;
const ENTITIES: Readonly<Record<string, string>> = { amp: "&", quot: '"', lt: "<", gt: ">", "#39": "'", "#x27": "'" };

const PixelSizeSchema = z.coerce.number().int().positive();

/** Every match of a fresh global pattern, read with `exec` (which keeps the named groups everywhere). */
function everyMatch(scanner: RegExp, text: string): RegExpExecArray[] {
	const matches: RegExpExecArray[] = [];
	for (let match = scanner.exec(text); match !== null; match = scanner.exec(text)) {
		matches.push(match);
	}
	return matches;
}

function decodeEntities(value: string): string {
	return value.replace(ENTITY_PATTERN, (match: string, entity: string): string => ENTITIES[entity] ?? match);
}

function attributesOf(tag: string): ReadonlyMap<string, string> {
	const attributes = new Map<string, string>();
	for (const match of everyMatch(attributePattern(), tag)) {
		const name = match.groups?.name;
		const value = match.groups?.double ?? match.groups?.single;
		if (name !== undefined && value !== undefined) {
			attributes.set(name.toLowerCase(), decodeEntities(value));
		}
	}
	return attributes;
}

function pixelSize(value: string | undefined): number | null {
	const parsed = PixelSizeSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/**
 * The pictures of an HTML fragment that holds nothing else (layout tags and
 * blank space around them are fine), in order; `null` when it holds anything
 * else, so it is shown as written.
 */
export function htmlImagesOf(html: string): MarkdownImage[] | null {
	const leftover = html.replace(imageTagPattern(), "").replace(LAYOUT_TAG_PATTERN, "");
	if (leftover.trim().length > 0) {
		return null;
	}
	return everyMatch(imageTagPattern(), html).flatMap((match: RegExpExecArray): MarkdownImage[] => {
		const attributes = attributesOf(match.groups?.attributes ?? "");
		const href = attributes.get("src");
		if (href === undefined || href.length === 0) {
			return [];
		}
		return [{ href, alt: attributes.get("alt") ?? "", width: pixelSize(attributes.get("width")), height: pixelSize(attributes.get("height")) }];
	});
}

/** Inline HTML: a line break, pictures, or — anything else — its text as written. */
function inlineHtml(token: RawToken): MarkdownInline[] {
	if (LINE_BREAK_TAG_PATTERN.test(token.raw.trim())) {
		return [{ kind: "break" }];
	}
	const images = htmlImagesOf(token.raw);
	return images === null ? [{ kind: "text", text: token.raw }] : images.map((image: MarkdownImage): MarkdownInline => ({ kind: "image", ...image }));
}

/** A block of HTML: its pictures, or — anything else — its text as a paragraph. */
function blockHtml(token: RawToken): MarkdownBlock[] {
	const images = htmlImagesOf(token.raw);
	if (images !== null) {
		return images.map((image: MarkdownImage): MarkdownBlock => ({ kind: "image", ...image, link: null }));
	}
	return token.raw.trim().length === 0 ? [] : [{ kind: "paragraph", children: [{ kind: "text", text: token.raw.trim() }] }];
}

function isBlank(inline: MarkdownInline): boolean {
	return (inline.kind === "text" && inline.text.trim().length === 0) || inline.kind === "break";
}

/** A link holding nothing but pictures (a badge): its pictures, which open the link; `null` for any other inline. */
function linkedImages(inline: MarkdownInline): MarkdownBlock[] | null {
	if (inline.kind === "image") {
		return [{ kind: "image", href: inline.href, alt: inline.alt, width: inline.width, height: inline.height, link: null }];
	}
	if (inline.kind !== "link") {
		return null;
	}
	const content = inline.children.filter((child: MarkdownInline): boolean => !isBlank(child));
	if (content.length === 0 || !content.every((child: MarkdownInline): boolean => child.kind === "image")) {
		return null;
	}
	return content.flatMap((child: MarkdownInline): MarkdownBlock[] =>
		child.kind === "image" ? [{ kind: "image", href: child.href, alt: child.alt, width: child.width, height: child.height, link: inline.href }] : [],
	);
}

/** A paragraph with its pictures lifted out into blocks of their own, the text around them kept in order. */
function paragraphBlocks(children: readonly MarkdownInline[]): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	let run: MarkdownInline[] = [];
	const flush = (): void => {
		if (run.some((inline: MarkdownInline): boolean => !isBlank(inline))) {
			blocks.push({ kind: "paragraph", children: run });
		}
		run = [];
	};
	for (const child of children) {
		const images = linkedImages(child);
		if (images === null) {
			run.push(child);
		} else {
			flush();
			blocks.push(...images);
		}
	}
	flush();
	return blocks;
}

/** Heading levels markdown has. */
const MAX_HEADING_LEVEL = 6;
const FIRST_ORDERED_NUMBER = 1;

function inlineOf(tokens: readonly RawToken[] | undefined, fallback: string): MarkdownInline[] {
	if (tokens === undefined) {
		return fallback.length === 0 ? [] : [{ kind: "text", text: fallback }];
	}
	return tokens.flatMap(toInline);
}

function toInline(token: RawToken): MarkdownInline[] {
	switch (token.type) {
		case "text":
		case "escape":
			return token.tokens === undefined ? [{ kind: "text", text: token.text ?? token.raw }] : token.tokens.flatMap(toInline);
		case "strong":
			return [{ kind: "strong", children: inlineOf(token.tokens, token.text ?? "") }];
		case "em":
			return [{ kind: "emphasis", children: inlineOf(token.tokens, token.text ?? "") }];
		case "del":
			return [{ kind: "strike", children: inlineOf(token.tokens, token.text ?? "") }];
		case "codespan":
			return [{ kind: "code", text: token.text ?? token.raw }];
		case "br":
			return [{ kind: "break" }];
		case "link":
			return token.href === undefined ? [{ kind: "text", text: token.raw }] : [{ kind: "link", href: token.href, children: inlineOf(token.tokens, token.text ?? token.href) }];
		case "image":
			return token.href === undefined ? [{ kind: "text", text: token.raw }] : [{ kind: "image", href: token.href, alt: token.text ?? "", width: null, height: null }];
		case "html":
			return inlineHtml(token);
		default:
			// Inline HTML and anything newer than this app: shown as written.
			return [{ kind: "text", text: token.raw }];
	}
}

function toBlocks(tokens: readonly RawToken[]): MarkdownBlock[] {
	return tokens.flatMap(toBlock);
}

function toBlock(token: RawToken): MarkdownBlock[] {
	switch (token.type) {
		case "space":
			return [];
		case "paragraph":
		case "text":
			return paragraphBlocks(inlineOf(token.tokens, token.text ?? token.raw));
		case "heading":
			return [{ kind: "heading", level: Math.min(Math.max(token.depth ?? 1, 1), MAX_HEADING_LEVEL), children: inlineOf(token.tokens, token.text ?? "") }];
		case "code":
			return [{ kind: "code", text: token.text ?? token.raw, language: token.lang === undefined || token.lang.length === 0 ? null : token.lang }];
		case "blockquote":
			return [{ kind: "quote", blocks: toBlocks(token.tokens ?? []) }];
		case "list":
			return [
				{
					kind: "list",
					ordered: token.ordered ?? false,
					start: token.start === undefined || token.start === "" ? FIRST_ORDERED_NUMBER : token.start,
					items: (token.items ?? []).map((item: RawToken): MarkdownListItem => ({
						checked: item.task === true ? (item.checked ?? false) : null,
						// A task item's leading checkbox token is drawn from `checked`, not as text.
						blocks: toBlocks((item.tokens ?? []).filter((child: RawToken): boolean => child.type !== "checkbox")),
					})),
				},
			];
		case "hr":
			return [{ kind: "rule" }];
		case "html":
			return blockHtml(token);
		case "table":
			return [
				{
					kind: "table",
					header: (token.header ?? []).map((cell: RawTableCell): MarkdownInline[] => inlineOf(cell.tokens, "")),
					rows: (token.rows ?? []).map((row: readonly RawTableCell[]): MarkdownInline[][] => row.map((cell: RawTableCell): MarkdownInline[] => inlineOf(cell.tokens, ""))),
				},
			];
		default:
			// Anything newer than this app: its raw text, as a paragraph.
			return token.raw.trim().length === 0 ? [] : [{ kind: "paragraph", children: [{ kind: "text", text: token.raw.trim() }] }];
	}
}

/** Markdown as the app's block tree; text the lexer cannot read at all becomes one plain paragraph. */
export function parseMarkdown(markdown: string): readonly MarkdownBlock[] {
	if (markdown.trim().length === 0) {
		return [];
	}
	const tokens = RawTokensSchema.safeParse(lexer(markdown, { gfm: true }));
	return tokens.success ? toBlocks(tokens.data) : [{ kind: "paragraph", children: [{ kind: "text", text: markdown }] }];
}

/** Web addresses a tap may open — never `javascript:`, `file:` or app schemes from someone else's comment. */
const OPENABLE_PROTOCOLS: readonly string[] = ["https:", "http:"];

/** The link's address when it is safe to open, `null` otherwise (a relative link, another scheme). */
export function openableHref(href: string): string | null {
	const parsed = z.url().safeParse(href);
	if (!parsed.success) {
		return null;
	}
	return OPENABLE_PROTOCOLS.includes(new URL(parsed.data).protocol) ? parsed.data : null;
}

/** The plain text of inline content — for screen readers and previews. */
export function plainTextOf(children: readonly MarkdownInline[]): string {
	return children
		.map((child: MarkdownInline): string => {
			switch (child.kind) {
				case "text":
				case "code":
					return child.text;
				case "strong":
				case "emphasis":
				case "strike":
				case "link":
					return plainTextOf(child.children);
				case "image":
					return child.alt;
				case "break":
					return " ";
			}
		})
		.join("");
}
