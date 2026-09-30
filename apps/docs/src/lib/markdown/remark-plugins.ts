import type { Blockquote, Code, Emphasis, Html, Image, ListItem, Paragraph, PhrasingContent, Root, Table, TableCell, TableRow, Text } from "mdast";
import { visit } from "unist-util-visit";
import { z } from "zod";

import { escapeHtml } from "./html";

/**
 * Remark (markdown AST) plugins for the docs site. Every plugin is pure AST
 * logic and emits **plain HTML elements** (through mdast `data.hName` /
 * `data.hProperties`, or small `html` nodes) — no framework components — so
 * the same markdown renders identically in any static pipeline and is
 * unit-testable without a browser.
 *
 * - `> [!NOTE]` blockquotes      → `<aside class="callout" data-kind="info">`
 * - glossary terms in prose      → `<abbr title="…">`
 * - relative image URLs          → `/images/…` (served from repo-root `docs/images/`)
 * - image-bearing tables         → a responsive screenshot gallery
 * - `mermaid` fences             → `<pre class="mermaid">` (rendered client-side)
 * - `[x]` / `[ ]` task markers   → ✓ / ☐ text
 * - the leading H1               → removed (the page title comes from frontmatter)
 */

// ─── Callouts ───────────────────────────────────────────────────────────────

export const QuoteKindSchema = z.enum(["info", "tip", "warning", "error", "success"]);

export type QuoteKind = z.infer<typeof QuoteKindSchema>;

/** GitHub-style `[!KIND]` markers → callout kind. */
export const QUOTE_MARKER_KINDS: Readonly<Record<string, QuoteKind>> = {
	note: "info",
	info: "info",
	tip: "tip",
	success: "success",
	warning: "warning",
	caution: "warning",
	important: "warning",
	error: "error",
	danger: "error",
};

/** Human label rendered as the callout title for an explicit marker. */
const MARKER_TITLES: Readonly<Record<string, string>> = {
	note: "Note",
	info: "Info",
	tip: "Tip",
	success: "Success",
	warning: "Warning",
	caution: "Caution",
	important: "Important",
	error: "Error",
	danger: "Danger",
};

/** Word-boundary anchored keyword detection for plain (marker-less) quotes. */
export function detectQuoteKind(text: string): QuoteKind {
	const lower = text.toLowerCase();
	if (/(?:\b(?:errors?|failed?|failure|broken|danger)\b|❌)/.test(lower)) {
		return "error";
	}
	if (/(?:\b(?:warnings?|caution|careful|important|gotcha|never|don'?t|wipes|pending)\b|⚠)/.test(lower)) {
		return "warning";
	}
	if (/(?:\b(?:success|succeeded)\b|✅)/.test(lower)) {
		return "success";
	}
	if (/(?:\b(?:tip|tips)\b|💡)/.test(lower)) {
		return "tip";
	}
	return "info";
}

/** Structural view of an mdast node — only the fields the text helpers read. */
interface MdastNodeLike {
	readonly type: string;
	readonly value?: string;
	readonly children?: readonly MdastNodeLike[];
}

/** Recursively joins all text in an mdast subtree (inline code and raw html included). */
export function collectText(node: MdastNodeLike): string {
	if ((node.type === "text" || node.type === "inlineCode" || node.type === "html") && node.value !== undefined) {
		return node.value;
	}
	return node.children === undefined ? "" : node.children.map(collectText).join("");
}

const MARKER_PATTERN = /^\[!(NOTE|INFO|TIP|SUCCESS|WARNING|CAUTION|IMPORTANT|ERROR|DANGER)\]\s*/i;

/** Removes the `[!KIND]` marker from the quote's first text node (dropping an emptied paragraph). */
function stripMarker(node: Blockquote): void {
	const paragraphIndex = node.children.findIndex((child) => child.type === "paragraph");
	const paragraph = node.children[paragraphIndex];
	if (paragraph?.type !== "paragraph") {
		return;
	}
	const textIndex = paragraph.children.findIndex((child) => child.type === "text");
	const text = paragraph.children[textIndex];
	if (text?.type !== "text") {
		return;
	}
	const stripped = text.value.replace(MARKER_PATTERN, "").trimStart();
	if (stripped.length > 0) {
		text.value = stripped;
		return;
	}
	if (paragraph.children.length <= 1) {
		node.children.splice(paragraphIndex, 1);
	} else {
		paragraph.children.splice(textIndex, 1);
	}
}

/**
 * Turns blockquotes into callouts: `<aside class="callout" data-kind="…">`,
 * with a `<p class="callout-title">` for explicit `[!KIND]` markers. Plain
 * quotes get a kind from keyword detection and no title.
 */
export function remarkCallouts(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "blockquote", (node: Blockquote) => {
			const text = node.children.map(collectText).join("");
			const marker = MARKER_PATTERN.exec(text)?.[1]?.toLowerCase();
			const kind: QuoteKind = marker === undefined ? detectQuoteKind(text) : (QUOTE_MARKER_KINDS[marker] ?? "info");

			if (marker !== undefined) {
				stripMarker(node);
				const title: Paragraph = {
					type: "paragraph",
					data: { hProperties: { className: ["callout-title"] } },
					children: [{ type: "text", value: MARKER_TITLES[marker] ?? "Note" }],
				};
				node.children.unshift(title);
			}

			node.data = { hName: "aside", hProperties: { className: ["callout"], "data-kind": kind } };
		});
	};
}

// ─── Glossary ───────────────────────────────────────────────────────────────

export interface GlossaryEntry {
	readonly term: string;
	readonly definition: string;
}

/** Terms wrapped in `<abbr title>` hover tooltips (longest term wins). */
export const GLOSSARY_TERMS: readonly GlossaryEntry[] = [
	{ term: "RBAC", definition: "Role-based access control — permissions granted via roles" },
	{ term: "ReBAC", definition: "Relationship-based access control — access derived from relationships such as membership" },
	{ term: "ABAC", definition: "Attribute-based access control — conditions on user and resource attributes" },
	{ term: "RLS", definition: "PostgreSQL Row-Level Security — database rules that hide rows per session" },
	{ term: "JWT", definition: "JSON Web Token — a signed, self-contained auth token" },
	{ term: "jti", definition: "JWT ID — a unique per-token identifier used to revoke sessions" },
	{ term: "HS256", definition: "HMAC-SHA256 — the symmetric signing algorithm for these JWTs" },
	{ term: "CORS", definition: "Cross-Origin Resource Sharing — which origins may call the API" },
	{ term: "CSRF", definition: "Cross-Site Request Forgery — an attack mitigated by SameSite cookies" },
	{ term: "SSR", definition: "Server-side rendering — HTML produced on the server per request" },
	{ term: "SPA", definition: "Single-page application — client-side navigation without full reloads" },
	{ term: "DTO", definition: "Data Transfer Object — the typed shape of a request/response body" },
	{ term: "ORM", definition: "Object-relational mapper — Prisma maps tables to TypeScript objects" },
	{ term: "idempotent", definition: "Safe to run repeatedly — the second run leaves the same state" },
];

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function glossaryNode(term: string, definition: string): Emphasis {
	return {
		type: "emphasis",
		data: { hName: "abbr", hProperties: { title: definition, className: ["glossary-term"] } },
		children: [{ type: "text", value: term }],
	};
}

/** Splits one text value into text + `<abbr>` pieces for every glossary match. */
export function splitGlossaryTerms(value: string, entries: readonly GlossaryEntry[] = GLOSSARY_TERMS): readonly PhrasingContent[] {
	const sorted = [...entries].sort((a, b) => b.term.length - a.term.length);
	const alternation = sorted.map((entry) => escapeRegExp(entry.term)).join("|");
	const pattern = new RegExp(`(^|[^A-Za-z0-9])(${alternation})(?=$|[^A-Za-z0-9])`, "g");
	const definitions = new Map(sorted.map((entry) => [entry.term, entry.definition]));

	const pieces: PhrasingContent[] = [];
	let cursor = 0;
	for (const match of value.matchAll(pattern)) {
		const prefix = match[1] ?? "";
		const term = match[2] ?? "";
		const start = match.index + prefix.length;
		if (start > cursor) {
			pieces.push({ type: "text", value: value.slice(cursor, start) } satisfies Text);
		}
		pieces.push(glossaryNode(term, definitions.get(term) ?? ""));
		cursor = start + term.length;
	}
	if (pieces.length === 0) {
		return [{ type: "text", value }];
	}
	if (cursor < value.length) {
		pieces.push({ type: "text", value: value.slice(cursor) });
	}
	return pieces;
}

/** Wraps glossary terms found in paragraph text (never inside code, links, or headings). */
export function remarkGlossary(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "paragraph", (node: Paragraph) => {
			node.children = node.children.flatMap((child): readonly PhrasingContent[] => (child.type === "text" ? splitGlossaryTerms(child.value) : [child]));
		});
	};
}

// ─── Images ─────────────────────────────────────────────────────────────────

/** `./images/x.png`, `../images/x.png`, `images/x.png` → `/images/x.png`. */
export function rewriteImageUrl(url: string): string {
	if (url.startsWith("./")) {
		return `/${url.slice(2)}`;
	}
	if (url.startsWith("../")) {
		return `/${url.replace(/^(?:\.\.\/)+/, "")}`;
	}
	if (url.startsWith("images/")) {
		return `/${url}`;
	}
	return url;
}

/** Rewrites repo-relative image URLs to the `/images/…` route (repo-root `docs/images/`). */
export function remarkImageUrls(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "image", (node: Image) => {
			node.url = rewriteImageUrl(node.url);
		});
	};
}

// ─── Image gallery ──────────────────────────────────────────────────────────

export interface GalleryItem {
	readonly title: string;
	readonly description: string;
	readonly src: string;
	readonly alt: string;
}

function findFirstImage(node: MdastNodeLike | Image): Image | undefined {
	if (node.type === "image" && "url" in node) {
		return node;
	}
	if (!("children" in node)) {
		return undefined;
	}
	for (const child of node.children) {
		const found = findFirstImage(child);
		if (found !== undefined) {
			return found;
		}
	}
	return undefined;
}

/** One gallery card from a table body row, or `null` when the row has no image. */
export function galleryItemFromRow(row: TableRow): GalleryItem | null {
	const cells: readonly TableCell[] = row.children;
	const imageCell = cells.find((cell) => findFirstImage(cell) !== undefined);
	const image = imageCell === undefined ? undefined : findFirstImage(imageCell);
	if (imageCell === undefined || image === undefined || image.url.length === 0) {
		return null;
	}
	const alt = image.alt ?? "";
	const label = cells
		.filter((cell) => cell !== imageCell)
		.map(collectText)
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
	const title = alt.length > 0 ? alt : label;
	const description = (label.startsWith(title) ? label.slice(title.length) : label)
		.replace(/^[(:,\s]+/, "")
		.replace(/[)]+$/, "")
		.trim();
	return { title, description, src: rewriteImageUrl(image.url), alt };
}

/** Renders gallery items as static, escaped HTML. */
export function galleryHtml(items: readonly GalleryItem[]): string {
	const figures = items
		.map(
			(item) =>
				`<figure class="gallery-item"><a href="${escapeHtml(item.src)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt)}" loading="lazy" decoding="async"></a>` +
				`<figcaption><strong>${escapeHtml(item.title)}</strong>${item.description.length > 0 ? `<span>${escapeHtml(item.description)}</span>` : ""}</figcaption></figure>`,
		)
		.join("");
	return `<div class="image-gallery">${figures}</div>`;
}

/** Tables whose every body row holds an image become a screenshot gallery grid. */
export function remarkImageGallery(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "table", (node: Table, index, parent) => {
			const bodyRows = node.children.slice(1);
			if (bodyRows.length === 0 || parent === undefined || index === undefined) {
				return;
			}
			const items: GalleryItem[] = [];
			for (const row of bodyRows) {
				const item = galleryItemFromRow(row);
				if (item === null) {
					return;
				}
				items.push(item);
			}
			const html: Html = { type: "html", value: galleryHtml(items) };
			parent.children.splice(index, 1, html);
		});
	};
}

// ─── Mermaid ────────────────────────────────────────────────────────────────

/** `mermaid` fences become `<pre class="mermaid">` for the client-side renderer (never syntax-highlighted). */
export function remarkMermaid(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "code", (node: Code, index, parent) => {
			if (node.lang !== "mermaid" || parent === undefined || index === undefined) {
				return;
			}
			const html: Html = { type: "html", value: `<div class="mermaid-diagram"><pre class="mermaid">${escapeHtml(node.value)}</pre></div>` };
			parent.children.splice(index, 1, html);
		});
	};
}

// ─── Task markers ───────────────────────────────────────────────────────────

const TASK_MARKER_PATTERN = /^\[(x| )\]\s?(.*)$/s;
const TASK_DONE = "✓";
const TASK_PENDING = "☐";

/** `[x] Label` → `✓ Label`, `[ ] Label` → `☐ Label`; `null` when the text has no marker. */
export function replaceTaskMarker(text: string): string | null {
	const match = TASK_MARKER_PATTERN.exec(text);
	if (match === null) {
		return null;
	}
	const marker = match[1] === "x" ? TASK_DONE : TASK_PENDING;
	return `${marker} ${match[2] ?? ""}`;
}

function startsWithTaskMarker(paragraph: Paragraph): boolean {
	const first = paragraph.children[0];
	return first?.type === "text" && (first.value.startsWith(TASK_DONE) || first.value.startsWith(TASK_PENDING) || TASK_MARKER_PATTERN.test(first.value));
}

/**
 * Renders task markers as static symbols: in table cells (GFM has no task
 * syntax there) and in GFM task lists (clearing `checked`, so no disabled
 * `<input>` checkbox is emitted).
 */
export function remarkTaskMarkers(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "tableCell", (cell: TableCell) => {
			const first = cell.children[0];
			if (first?.type !== "text") {
				return;
			}
			const replaced = replaceTaskMarker(first.value);
			if (replaced !== null) {
				first.value = replaced;
			}
		});

		visit(tree, "listItem", (item: ListItem) => {
			if (typeof item.checked !== "boolean") {
				return;
			}
			const marker = item.checked ? TASK_DONE : TASK_PENDING;
			item.checked = null;
			const first = item.children[0];
			if (first?.type !== "paragraph" || startsWithTaskMarker(first)) {
				return;
			}
			const lead = first.children[0];
			if (lead?.type === "text") {
				lead.value = `${marker} ${lead.value}`;
			} else {
				first.children.unshift({ type: "text", value: `${marker} ` });
			}
		});
	};
}

// ─── Leading heading ────────────────────────────────────────────────────────

/** Removes the first top-level H1 — the page title renders from frontmatter. */
export function remarkStripFirstHeading(): (tree: Root) => void {
	return (tree: Root): void => {
		const index = tree.children.findIndex((child) => child.type === "heading" && child.depth === 1);
		if (index >= 0) {
			tree.children.splice(index, 1);
		}
	};
}
