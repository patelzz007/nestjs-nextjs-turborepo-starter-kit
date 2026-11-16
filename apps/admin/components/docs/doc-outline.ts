// ============================================
// components/docs/doc-outline.ts — a guide's headings, with stable ids
// ============================================
// The page's "On this page" outline and the rendered headings must agree on
// every id, so both come from here: `extractDocOutline` reads the outline from
// the Markdown source, and `remarkHeadingIds` stamps the same ids onto the
// headings react-markdown renders. Section headings (##, ###) are outlined.

import type { Heading, Root } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

/** The heading depths the outline lists: sections (##) and subsections (###). */
export type DocHeadingDepth = 2 | 3;

export interface DocHeading {
	readonly id: string;
	readonly text: string;
	readonly depth: DocHeadingDepth;
}

const FALLBACK_SLUG = "section";

/** "Reading an existing HTTP API (`useApi`)" → "reading-an-existing-http-api-useapi". */
export function slugifyHeading(text: string): string {
	const slug = text
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
		.trim()
		.replace(/[\s-]+/gu, "-")
		.replace(/^-|-$/gu, "");
	return slug === "" ? FALLBACK_SLUG : slug;
}

function outlinedDepth(heading: Heading): DocHeadingDepth | null {
	return heading.depth === 2 || heading.depth === 3 ? heading.depth : null;
}

interface OutlinedHeading {
	readonly node: Heading;
	readonly heading: DocHeading;
}

/** The section headings at the top level of the document, in order, each with a unique id (`setup`, `setup-2`). */
function outlineOf(tree: Root): readonly OutlinedHeading[] {
	const seen = new Map<string, number>();
	return tree.children.flatMap((node): OutlinedHeading[] => {
		if (node.type !== "heading") {
			return [];
		}
		const depth = outlinedDepth(node);
		if (depth === null) {
			return [];
		}
		const text = toString(node);
		const base = slugifyHeading(text);
		const count = (seen.get(base) ?? 0) + 1;
		seen.set(base, count);
		return [{ node, heading: { id: count === 1 ? base : `${base}-${String(count)}`, text, depth } }];
	});
}

/** The guide's outline, read from its Markdown source. */
export function extractDocOutline(source: string): readonly DocHeading[] {
	const tree = unified().use(remarkParse).use(remarkGfm).parse(source);
	return outlineOf(tree).map(({ heading }) => heading);
}

/** A remark plugin: gives each outlined heading the id `extractDocOutline` lists for it. */
export function remarkHeadingIds(): (tree: Root) => void {
	return (tree: Root): void => {
		for (const { node, heading } of outlineOf(tree)) {
			node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: heading.id } };
		}
	};
}
