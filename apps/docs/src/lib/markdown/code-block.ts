import { z } from "zod";
import { highlightCode, resolveCodeBlockLanguage, type CodeBlockLine } from "@workspace/ui/components/code-block-highlight";
import type { Element, Root } from "hast";
import type { Raw } from "mdast-util-to-hast";
import { visit } from "unist-util-visit";

import { presentationFor, type DocsCodeBlockProps } from "../code-block/props";
import { renderCodeBlockIsland } from "../code-block/render";
import { parseCodeTitle, parseHighlightLines } from "./fence-meta";

/**
 * Code fences → the shared `CodeBlock` from `@workspace/ui` (the full ReUI
 * port). At build time each fence is highlighted with the component's own
 * engine (`highlightCode`: Shiki, github-light + github-dark), rendered to
 * HTML, and shipped with its props so the browser hydrates it into the live
 * component (copy, wrap, folding, expand). Fence meta:
 *
 *     ```ts title="main.ts" {2-4}
 */

/** A hast `className` property: a list of class tokens. */
const CLASS_LIST_SCHEMA = z.array(z.union([z.string(), z.number()]));
const LANGUAGE_CLASS_PREFIX = "language-";

/** Fence tag from `class="language-ts"`; empty when the fence has none. */
export function fenceLanguage(code: Element): string {
	const classes = CLASS_LIST_SCHEMA.safeParse(code.properties.className);
	if (!classes.success) {
		return "";
	}
	for (const name of classes.data) {
		const className = String(name);
		if (className.startsWith(LANGUAGE_CLASS_PREFIX)) {
			return className.slice(LANGUAGE_CLASS_PREFIX.length);
		}
	}
	return "";
}

/** The raw source inside a `<code>` element, without the trailing newline remark adds. */
export function codeSource(code: Element): string {
	let text = "";
	visit(code, "text", (node) => {
		text += node.value;
	});
	return text.replace(/\n$/, "");
}

/** Fence meta (`title="…" {1-3}`), which remark-rehype keeps on the `<code>` element's data. */
export function fenceMeta(code: Element): string {
	return code.data?.meta ?? "";
}

/**
 * Whether highlighting silently failed: a supported language whose code came
 * back with no coloured token at all (the highlighter falls back to plain text
 * on any error, e.g. a grammar that could not be imported).
 */
export function highlightingFailed(language: string, source: string, lines: readonly CodeBlockLine[]): boolean {
	const supported = resolveCodeBlockLanguage(language) !== undefined;
	const hasColour = lines.some((line) => line.tokens.some((token) => token.color !== undefined));
	return supported && source.trim().length > 0 && !hasColour;
}

/** Everything the page needs to render and hydrate one fence. Throws rather than ship uncoloured code. */
export async function codeBlockProps(source: string, language: string, meta: string): Promise<DocsCodeBlockProps> {
	const lines = await highlightCode(source, { language, highlightedLines: [...parseHighlightLines(meta)] });
	if (highlightingFailed(language, source, lines)) {
		throw new Error(`Code block (${language}) came back unhighlighted. Is preloadCodeBlockHighlighter() awaited in astro.config.ts?`);
	}
	return { lines, language, title: parseCodeTitle(meta), ...presentationFor(language, lines.length) };
}

interface Fence {
	readonly parent: Root | Element;
	readonly index: number;
	readonly code: Element;
}

/** Rehype plugin: replaces every `<pre><code>` fence with a hydratable `CodeBlock`. */
export function rehypeCodeBlock(): (tree: Root) => Promise<void> {
	return async (tree: Root): Promise<void> => {
		const fences: Fence[] = [];
		visit(tree, "element", (node: Element, index, parent) => {
			const [code] = node.children;
			if (node.tagName !== "pre" || index === undefined || parent === undefined || code?.type !== "element" || code.tagName !== "code") {
				return;
			}
			fences.push({ parent, index, code });
		});

		// Replace back to front so earlier indices stay valid.
		for (const { parent, index, code } of fences.reverse()) {
			const props = await codeBlockProps(codeSource(code), fenceLanguage(code), fenceMeta(code));
			// A raw node: Astro's pipeline parses raw HTML (rehype-raw) after the user plugins.
			const replacement: Raw = { type: "raw", value: renderCodeBlockIsland(props) };
			parent.children.splice(index, 1, replacement);
		}
	};
}
