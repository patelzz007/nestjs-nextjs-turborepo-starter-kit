import type { Node, Root } from "fumadocs-core/page-tree";
import { createElement, type ReactNode } from "react";

import { DOCS_SECTION_ICONS, resolveDocsPageIcon, resolveDocsSectionIcon } from "@/lib/docs-nav-icons";
import { source } from "@/lib/source";
import type { PanelSectionColor } from "@workspace/ui/lib/sidebar/menu-view";

/** Re-exported for landing page section headers. */
export const SECTION_ICONS = DOCS_SECTION_ICONS;

/** Colored section dots — same palette as admin / merchant sidebars. */
export const SECTION_COLORS: Readonly<Record<string, PanelSectionColor>> = {
	"Getting Started": "blue",
	"Architecture & Auth": "green",
	Infrastructure: "teal",
	"Tooling & DX": "amber",
	"Deep Dives": "purple",
	Roadmaps: "rose",
};

/**
 * Attaches icons to every page and section separator, recursing into folders.
 * Icons are compulsory — unmapped slugs fall back to `DEFAULT_DOCS_PAGE_ICON`.
 */
function withIcons(nodes: readonly Node[]): Node[] {
	return nodes.map((node) => {
		if (node.type === "page") {
			const slug = node.url.replace(/^\/docs\//, "");
			const Icon = resolveDocsPageIcon(slug);
			const icon: ReactNode = createElement(Icon, { className: "size-4" });
			return { ...node, icon };
		}
		if (node.type === "separator") {
			const name = typeof node.name === "string" ? node.name.trim() : treeNodeLabel(node.name);
			const Icon = resolveDocsSectionIcon(name);
			return { ...node, name, icon: createElement(Icon, { className: "size-4" }) };
		}
		return { ...node, children: withIcons(node.children) };
	});
}

function treeNodeLabel(name: ReactNode): string {
	return typeof name === "string" ? name.trim() : "";
}

/**
 * The sidebar tree with per-page icons. Pass this to `<DocsLayout tree=…>`.
 * Every page has an icon so the nav stays aligned and scannable.
 */
export function getDocsTree(): Root {
	const tree = source.getPageTree();
	return { ...tree, children: withIcons(tree.children) };
}
