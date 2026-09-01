import type { Root } from "fumadocs-core/page-tree";
import type { ReactNode } from "react";

import { getBlogPosts } from "@/lib/blog";
import { source } from "@/lib/source";

export interface SectionPage {
	readonly title: string;
	readonly url: string;
	readonly description: string;
}

export interface DocsSection {
	readonly title: string;
	readonly pages: readonly SectionPage[];
}

/** Page-tree node names are `ReactNode`; guides only use plain strings. */
function treeTitle(name: ReactNode): string {
	return typeof name === "string" ? name : "";
}

/**
 * Rebuilds the sidebar's sections (separator → pages) from the page tree so
 * landing quick links never drift from `docs/meta.json`.
 */
export function buildDocsSections(tree: Root): readonly DocsSection[] {
	const descriptions = new Map(source.getPages().map((page) => [page.url, page.data.description ?? ""]));
	const sections: { title: string; pages: SectionPage[] }[] = [];
	let current: { title: string; pages: SectionPage[] } | undefined;
	for (const node of tree.children) {
		if (node.type === "separator") {
			current = { title: treeTitle(node.name).trim(), pages: [] };
			sections.push(current);
		} else if (node.type === "page") {
			if (current === undefined) {
				current = { title: "Guides", pages: [] };
				sections.push(current);
			}
			current.pages.push({ title: treeTitle(node.name), url: node.url, description: descriptions.get(node.url) ?? "" });
		}
	}
	return sections.filter((section) => section.pages.length > 0);
}

export const DOCS_LANDING_STATS: readonly { readonly label: string; readonly value: string }[] = [
	{ label: "Guides", value: String(source.getPages().length) },
	{ label: "Sections", value: String(buildDocsSections(source.getPageTree()).length) },
	{ label: "Articles", value: String(getBlogPosts().length) },
];

/** Curated entry points for the docs hub hero. */
export const FEATURED_GUIDES: readonly { readonly title: string; readonly href: string; readonly hint: string }[] = [
	{ title: "Getting started", href: "/docs/getting-started", hint: "Setup from zero" },
	{ title: "Architecture", href: "/docs/architecture", hint: "Monorepo map" },
	{ title: "Add a feature", href: "/docs/ADDING-A-FEATURE", hint: "End-to-end flow" },
	{ title: "API routes", href: "/docs/api-routes", hint: "Contract patterns" },
];
