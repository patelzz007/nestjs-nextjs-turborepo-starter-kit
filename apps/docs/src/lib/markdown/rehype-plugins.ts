import type { Element, ElementContent, Root } from "hast";
import { visit } from "unist-util-visit";

/**
 * Rehype (HTML AST) plugins for the docs site. They run after Astro has
 * assigned heading ids (github-slugger), so anchors match the link checker.
 */

const ANCHORED_HEADINGS: ReadonlySet<string> = new Set(["h2", "h3", "h4"]);

/** Appends a hover "#" permalink to h2–h4 headings that have an id. */
export function rehypeHeadingAnchors(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element) => {
			const id = node.properties.id;
			if (!ANCHORED_HEADINGS.has(node.tagName) || typeof id !== "string") {
				return;
			}
			const anchor: ElementContent = {
				type: "element",
				tagName: "a",
				properties: { className: ["heading-anchor"], href: `#${id}`, ariaLabel: "Link to this section" },
				children: [{ type: "text", value: "#" }],
			};
			node.children.push(anchor);
		});
	};
}

/** Whether an href leaves the site (absolute http/https). */
export function isExternalHref(href: string): boolean {
	return /^https?:\/\//i.test(href);
}

/** External links open in a new tab without leaking the opener. */
export function rehypeExternalLinks(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element) => {
			const href = node.properties.href;
			if (node.tagName !== "a" || typeof href !== "string" || !isExternalHref(href)) {
				return;
			}
			node.properties.target = "_blank";
			node.properties.rel = ["noopener", "noreferrer"];
		});
	};
}

/** Wraps tables in a horizontally scrollable container so wide tables never break the layout. */
export function rehypeTableWrapper(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element, index, parent) => {
			if (node.tagName !== "table" || parent === undefined || index === undefined) {
				return;
			}
			const wrapper: Element = { type: "element", tagName: "div", properties: { className: ["table-wrapper"] }, children: [node] };
			parent.children.splice(index, 1, wrapper);
		});
	};
}
