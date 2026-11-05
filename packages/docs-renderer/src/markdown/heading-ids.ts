import GithubSlugger from "github-slugger";
import type { Element, Root } from "hast";
import { toString } from "hast-util-to-string";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { z } from "zod";

/** One heading of a rendered page: what the "On this page" rail, search and quick links read. */
export interface RenderedHeading {
	readonly depth: number;
	readonly slug: string;
	readonly text: string;
}

declare module "vfile" {
	interface DataMap {
		/** Every h1–h6 in document order, collected by `rehypeHeadingIds`. */
		headings: RenderedHeading[];
	}
}

const HEADING_TAG = /^h(?<level>[1-6])$/;
const ID_SCHEMA = z.string();

/**
 * Gives every heading the `id` GitHub gives it (github-slugger over the heading's text, de-duplicated per
 * page: `setup`, `setup-1`), so `#section` links work on GitHub and on the site alike, and records the
 * headings on `file.data.headings`. Same algorithm as the `rehypeHeadingIds` Astro used, so every anchor the
 * Astro site published keeps working (`apps/docs/regression-baseline/routes.json` checks it). A heading that
 * already has an id keeps it.
 */
export function rehypeHeadingIds(): (tree: Root, file: VFile) => void {
	return (tree: Root, file: VFile): void => {
		const slugger = new GithubSlugger();
		const headings: RenderedHeading[] = [];
		visit(tree, "element", (node: Element) => {
			const level = HEADING_TAG.exec(node.tagName)?.groups?.level;
			if (level === undefined) {
				return;
			}
			const text = toString(node);
			const existing = ID_SCHEMA.safeParse(node.properties.id);
			const slug = existing.success ? existing.data : slugger.slug(text);
			node.properties.id = slug;
			headings.push({ depth: Number(level), slug, text });
		});
		file.data.headings = headings;
	};
}
