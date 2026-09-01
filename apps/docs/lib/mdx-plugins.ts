import type { BlockContent, Blockquote, DefinitionContent, Image, ListItem, Paragraph, PhrasingContent, Root, Table, TableCell, TableRow, Text } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";
import { z } from "zod";

/**
 * Ported markdown plugins + helpers from the old admin docs renderer
 * (`apps/admin/lib/docs/markdown.ts` + the renderer's remark plugins), adapted
 * for the Fumadocs MDX pipeline. Instead of stamping hast classes/data (the
 * react-markdown approach), each plugin **rewrites mdast into MDX JSX
 * elements** that map to the app's components:
 *
 * - `> [!NOTE]`-style blockquotes → `<Callout type="...">`
 * - glossary terms in prose → `<abbr title="...">`
 * - `mermaid` fences → `<Mermaid>` (handled by `remarkMdxMermaid`)
 * - relative image URLs → `/images/…` (served from the repo-root `docs/images/`)
 * - image-bearing tables → `<ImageGallery items=…>`
 * - the leading H1 → removed (the page title comes from frontmatter)
 *
 * Code fences are NOT rewritten here — Fumadocs' rehype-code highlights them
 * and the official `CodeBlock` component renders them.
 *
 * Everything here is pure AST/string logic — no React, no `server-only` — so
 * it is unit-testable and safe for the build-time MDX compiler.
 */

// ─── Quote kinds (callouts) ─────────────────────────────────────────────────

/** Blockquote kinds for the docs renderer's color-coded callouts. */
export const QuoteKindSchema = z.enum(["info", "tip", "warning", "error", "success"]);

export type QuoteKind = z.infer<typeof QuoteKindSchema>;

/** Maps GitHub-style `[!KIND]` markers to the app's quote kinds. */
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

/** Word-boundary anchored so neutral prose can't accidentally tint a callout. */
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

// ─── Glossary terms ─────────────────────────────────────────────────────────

/**
 * Terms the docs renderer wraps in `<abbr title>` tooltips. Longest-first
 * matching, so a multi-word term wins over its prefix.
 */
export const GLOSSARY_TERMS: readonly { readonly term: string; readonly definition: string }[] = [
	{ term: "RBAC", definition: "Role-based access control — permissions granted via roles" },
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
	{ term: "granular", definition: "Fine-grained — broken into small, specific pieces" },
];

// ─── JSX builders ───────────────────────────────────────────────────────────

function jsxAttribute(name: string, value: string): MdxJsxAttribute {
	return { type: "mdxJsxAttribute", name, value };
}

function jsxFlow(name: string, attributes: readonly MdxJsxAttribute[], children: readonly (BlockContent | DefinitionContent)[] = []): MdxJsxFlowElement {
	return { type: "mdxJsxFlowElement", name, attributes: [...attributes], children: [...children] };
}

/** `[x]` / `[ ]` prefix used in audit task tables and GFM task lists. */
const TASK_MARKER_PATTERN = /^\[(x| )\]\s?(.*)$/s;

const TASK_MARKER_DONE = "✓";
const TASK_MARKER_PENDING = "☐";

function phrasingFromTaskMarker(text: string): PhrasingContent[] | null {
	const match = TASK_MARKER_PATTERN.exec(text);
	if (match === null) {
		return null;
	}
	const checked = match[1] === "x";
	const label = match[2] ?? "";
	const marker = checked ? TASK_MARKER_DONE : TASK_MARKER_PENDING;
	const value = label.length > 0 ? `${marker} ${label}` : `${marker} `;
	return [{ type: "text", value }];
}

function paragraphHasTaskMarker(paragraph: Paragraph): boolean {
	const first = paragraph.children[0];
	if (first?.type !== "text") {
		return false;
	}
	return first.value.startsWith(TASK_MARKER_DONE) || first.value.startsWith(TASK_MARKER_PENDING) || TASK_MARKER_PATTERN.test(first.value);
}

function prependTaskMarkerToParagraph(paragraph: Paragraph, checked: boolean): void {
	if (paragraphHasTaskMarker(paragraph)) {
		return;
	}
	const marker = checked ? TASK_MARKER_DONE : TASK_MARKER_PENDING;
	const next = paragraph.children[0];
	if (next?.type === "text") {
		paragraph.children[0] = { type: "text", value: `${marker} ${next.value}` };
		return;
	}
	paragraph.children = [{ type: "text", value: `${marker} ` }, ...paragraph.children];
}

/**
 * Structural view of an mdast node — only the fields these helpers read.
 * mdast's discriminated union is assignable to this shape (every node has a
 * `type`; leaves carry `value`, parents carry `children`), which keeps the
 * recursive helpers free of index-signature casts.
 */
interface MdastNodeLike {
	readonly type: string;
	readonly value?: unknown;
	readonly url?: unknown;
	readonly alt?: unknown;
	readonly children?: readonly MdastNodeLike[];
}

/** Recursively joins all text in an mdast subtree (inline code included). */
function collectText(node: MdastNodeLike): string {
	if (node.type === "text" && typeof node.value === "string") {
		return node.value;
	}
	if (node.type === "inlineCode" && typeof node.value === "string") {
		return node.value;
	}
	if (node.type === "html" && typeof node.value === "string") {
		return node.value;
	}
	const children = node.children;
	if (children !== undefined) {
		return children.map(collectText).join("");
	}
	return "";
}

/** Type guard: true when the node is an mdast `image` node. */
function isImageNode(node: MdastNodeLike): node is Image {
	return node.type === "image";
}

/** Recursively finds the FIRST `image` node in an mdast subtree, if any. */
function findFirstImage(node: MdastNodeLike): Image | undefined {
	if (isImageNode(node)) {
		return node;
	}
	const children = node.children;
	if (children !== undefined) {
		for (const child of children) {
			const found = findFirstImage(child);
			if (found !== undefined) {
				return found;
			}
		}
	}
	return undefined;
}

// ─── remarkQuoteKindsPlugin ────────────────────────────────────────────────

const MARKER_PATTERN = /^\[!(NOTE|INFO|TIP|SUCCESS|WARNING|CAUTION|IMPORTANT|ERROR|DANGER)\]\s*/i;

/** Collects the plain text of a blockquote (for kind detection). */
function collectQuoteText(node: Blockquote): string {
	return node.children.map(collectText).join("");
}

/**
 * Converts blockquotes into `<Callout type="…">` components. Supports
 * GitHub-style markers (`> [!NOTE]`, `> [!WARNING]`, … — stripped from the
 * rendered text) and falls back to keyword detection from the quote body.
 * The `Callout` component renders the color/icon per kind and extracts a
 * leading `**Title:**`.
 */
export function remarkQuoteKindsPlugin(): (tree: Root) => void {
	return function transformer(tree: Root): void {
		visit(tree, "blockquote", (node: Blockquote, index, parent) => {
			const text = collectQuoteText(node);
			const markerMatch = MARKER_PATTERN.exec(text);
			const kind: QuoteKind = markerMatch?.[1] !== undefined ? (QUOTE_MARKER_KINDS[markerMatch[1].toLowerCase()] ?? "info") : detectQuoteKind(text);

			// Strip the `[!KIND]` marker from the first paragraph's leading text node.
			if (markerMatch !== null) {
				const firstParagraphIndex = node.children.findIndex((child) => child.type === "paragraph");
				const firstParagraph = firstParagraphIndex >= 0 ? node.children[firstParagraphIndex] : undefined;
				if (firstParagraph?.type === "paragraph") {
					const firstTextIndex = firstParagraph.children.findIndex((child) => child.type === "text");
					const firstText = firstTextIndex >= 0 ? firstParagraph.children[firstTextIndex] : undefined;
					if (firstText?.type === "text") {
						const stripped = firstText.value.replace(MARKER_PATTERN, "").trimStart();
						if (stripped.length === 0) {
							if (firstParagraph.children.length <= 1) {
								node.children.splice(firstParagraphIndex, 1);
							} else {
								firstParagraph.children.splice(firstTextIndex, 1);
							}
						} else {
							firstText.value = stripped;
						}
					}
				}
			}

			if (parent !== undefined && index !== undefined) {
				parent.children.splice(index, 1, jsxFlow("Callout", [jsxAttribute("type", kind)], node.children));
			}
		});
	};
}

// ─── remarkGlossaryPlugin ───────────────────────────────────────────────────

/**
 * Wraps glossary keywords in `<abbr title="…">` for hover tooltips. Exact
 * word-boundary matches on the plain text (not inside code spans); longest
 * term wins.
 */
export function remarkGlossaryPlugin(): (tree: Root) => void {
	const sortedTerms: readonly { readonly term: string; readonly definition: string }[] = [...GLOSSARY_TERMS].sort((a, b) => b.term.length - a.term.length);

	return function transformer(tree: Root): void {
		visit(tree, "paragraph", (node: Paragraph) => {
			for (const child of node.children) {
				if (child.type !== "text") {
					continue;
				}
				const textNode = child;
				const pieces: (string | MdxJsxTextElement)[] = [];
				let remaining = textNode.value;
				let changed = false;
				for (const { term, definition } of sortedTerms) {
					const pattern = new RegExp(`(^|[^A-Za-z0-9])(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^A-Za-z0-9])`, "g");
					let match: RegExpExecArray | null;
					while ((match = pattern.exec(remaining)) !== null) {
						changed = true;
						const prefix = match[1] ?? "";
						const matchedTerm = match[2] ?? "";
						const suffix = remaining.slice(match.index + match[0].length);
						const before = remaining.slice(0, match.index + prefix.length);
						pieces.push(before, {
							type: "mdxJsxTextElement",
							name: "abbr",
							attributes: [jsxAttribute("title", definition.replace(/"/g, "&quot;"))],
							children: [{ type: "text", value: matchedTerm }],
						});
						remaining = suffix;
						pattern.lastIndex = 0;
					}
				}
				if (changed) {
					pieces.push(remaining);
					const replacements = pieces.map((piece): Text | MdxJsxTextElement => {
						if (typeof piece === "string") {
							return { type: "text", value: piece } satisfies Text;
						}
						return piece;
					});
					node.children.splice(node.children.indexOf(child), 1, ...replacements);
				}
			}
		});
	};
}

// ─── remarkImageRewritePlugin ───────────────────────────────────────────────

/**
 * Rewrites repo-relative image URLs (`./images/email/verification.png`) to
 * web-relative ones (`/images/email/verification.png`), served from the
 * repo-root `docs/images/` folder via the `/images/[...path]` route handler.
 * Kept as plain `<img>` (the `img` component adds the lightbox) — no bundling
 * needed.
 */
export function remarkImageRewritePlugin(): (tree: Root) => void {
	return function transformer(tree: Root): void {
		visit(tree, "image", (node: Image) => {
			const url = node.url;
			if (url.startsWith("./")) {
				node.url = `/${url.slice(2)}`;
			} else if (url.startsWith("../")) {
				node.url = `/${url.replace(/^(?:\.\.\/)+/, "")}`;
			} else if (url.startsWith("images/")) {
				node.url = `/${url}`;
			}
		});
	};
}

// ─── remarkImageGalleryPlugin ───────────────────────────────────────────────

/** One gallery card: the screenshot plus its caption. */
interface GalleryItem {
	readonly title: string;
	readonly description: string;
	readonly src: string;
	readonly alt: string;
}

/** A table row split into its cells (mdast `tableCell` elements). */
function cellsOfRow(row: TableRow): readonly TableCell[] {
	return row.children;
}

/** Extracts a gallery item from one body row — `null` when the row has no image. */
function extractRowItem(row: TableRow): GalleryItem | null {
	const cells = cellsOfRow(row);
	const imageCell = cells.find((cell) => findFirstImage(cell) !== undefined);
	if (imageCell === undefined) {
		return null;
	}
	const img = findFirstImage(imageCell);
	if (img === undefined) {
		return null;
	}
	const src = img.url;
	if (src.length === 0) {
		return null;
	}
	const alt = img.alt ?? "";

	const labelText = cells
		.filter((cell) => cell !== imageCell)
		.map(collectText)
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
	const title = alt.length > 0 ? alt : labelText;
	const description = (labelText.startsWith(title) ? labelText.slice(title.length) : labelText)
		.replace(/^[(:,\s]+/, "")
		.replace(/[)]+$/, "")
		.trim();

	return { title, description, src, alt };
}

/**
 * Detects tables whose body rows all carry an image and converts them into
 * `<ImageGallery items=…>` (the card grid). A single image-less body row
 * aborts the whole detection (mixed-shape table → regular table).
 */
export function remarkImageGalleryPlugin(): (tree: Root) => void {
	return function transformer(tree: Root): void {
		visit(tree, "table", (node: Table, index, parent) => {
			// GFM tables: the FIRST row is the header — body rows follow it.
			const bodyRows = node.children.slice(1);
			if (bodyRows.length === 0) {
				return;
			}
			const items: GalleryItem[] = [];
			for (const row of bodyRows) {
				const item = extractRowItem(row);
				if (item === null) {
					return;
				}
				items.push(item);
			}
			if (parent !== undefined && index !== undefined) {
				parent.children.splice(index, 1, jsxFlow("ImageGallery", [jsxAttribute("items", JSON.stringify(items))], []));
			}
		});
	};
}

// ─── remarkStripFirstHeadingPlugin ──────────────────────────────────────────

/**
 * Renders `[x]` / `[ ]` markers as static text symbols.
 *
 * - Table cells: `| [x] Task | … |` (GFM does not support task syntax in tables).
 * - List items: prepends `✓` / `☐` and clears `listItem.checked` so the MDX
 *   pipeline does not also emit `<input type="checkbox">` nodes (Fumadocs would
 *   otherwise output two checkbox inputs per item).
 */
export function remarkTaskCheckboxPlugin(): (tree: Root) => void {
	return function transformer(tree: Root): void {
		visit(tree, "tableCell", (cell: TableCell) => {
			const first = cell.children[0];
			if (first?.type !== "text") {
				return;
			}
			const replacement = phrasingFromTaskMarker(first.value);
			if (replacement !== null) {
				cell.children = [...replacement, ...cell.children.slice(1)];
			}
		});

		visit(tree, "listItem", (item: ListItem) => {
			if (typeof item.checked !== "boolean") {
				return;
			}
			const checked = item.checked;
			item.checked = null;
			const first = item.children[0];
			if (first?.type !== "paragraph") {
				return;
			}
			prependTaskMarkerToParagraph(first, checked);
		});
	};
}

/**
 * Removes the leading H1 from the article body — the page title renders from
 * frontmatter via `DocsTitle`, so keeping the body H1 would duplicate it.
 */
export function remarkStripFirstHeadingPlugin(): (tree: Root) => void {
	return function transformer(tree: Root): void {
		let stripped = false;
		visit(tree, "heading", (node, index, parent) => {
			if (stripped) {
				return;
			}
			if (node.depth === 1 && parent?.type === "root" && index !== undefined) {
				stripped = true;
				parent.children.splice(index, 1);
			}
		});
	};
}
