import type { Element, ElementContent, Root } from "hast";
import { z } from "zod";
import { visit } from "unist-util-visit";

/**
 * Rehype (HTML AST) plugins for the docs site. They run after Astro has
 * assigned heading ids (github-slugger), so anchors match the link checker.
 */

const ANCHORED_HEADINGS: ReadonlySet<string> = new Set(["h2", "h3", "h4"]);
/** A hast string property (`id`, `href`); other property shapes are ignored. */
const STRING_PROPERTY_SCHEMA = z.string();

/** Appends a hover "#" permalink to h2–h4 headings that have an id. */
export function rehypeHeadingAnchors(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element) => {
			const id = STRING_PROPERTY_SCHEMA.safeParse(node.properties.id);
			if (!ANCHORED_HEADINGS.has(node.tagName) || !id.success) {
				return;
			}
			const anchor: ElementContent = {
				type: "element",
				tagName: "a",
				properties: { className: ["heading-anchor"], href: `#${id.data}`, ariaLabel: "Link to this section" },
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
			const href = STRING_PROPERTY_SCHEMA.safeParse(node.properties.href);
			if (node.tagName !== "a" || !href.success || !isExternalHref(href.data)) {
				return;
			}
			node.properties.target = "_blank";
			node.properties.rel = ["noopener", "noreferrer"];
		});
	};
}

/** Where a path may break across lines: after `.` and `/` (`src/config`, `api-config.ts`). */
const PATH_BREAK = /(?<=[./])(?=[^./])/u;
/** Where a long identifier may break: after `_` (`WEBHOOK_RATE_LIMIT_PER_MINUTE`). */
const UNDERSCORE_BREAK = /(?<=_)(?=[^_])/u;
/** Identifiers up to this many characters stay whole, so a column of short names never chops them up. */
const UNBROKEN_IDENTIFIER_MAX = 22;

/**
 * Lets the code inside a table cell wrap at the joints of an identifier:
 * a `<wbr>` after each `.` and `/`, and after each `_` of a long identifier. A table's columns are otherwise as
 * wide as its longest identifier (`WEBHOOK_RATE_LIMIT_PER_MINUTE`), which
 * pushes reference tables past the reading column. `<wbr>` only offers a
 * break: nothing changes on one line, and copied text stays the same.
 */
function withIdentifierBreaks(code: Element): void {
	code.children = code.children.flatMap((child): ElementContent[] => {
		if (child.type !== "text") {
			return [child];
		}
		const parts = child.value.split(PATH_BREAK).flatMap((part) => (part.length > UNBROKEN_IDENTIFIER_MAX ? part.split(UNDERSCORE_BREAK) : [part]));
		return parts.flatMap((part, partIndex): ElementContent[] => {
			const text: ElementContent = { type: "text", value: part };
			return partIndex === 0 ? [text] : [{ type: "element", tagName: "wbr", properties: {}, children: [] }, text];
		});
	});
}

/**
 * Wraps tables in a horizontally scrollable container so a table that is still
 * wider than the reading column scrolls inside its frame instead of breaking
 * the layout, and lets identifiers in its cells wrap (`withIdentifierBreaks`).
 */
export function rehypeTableWrapper(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element, index, parent) => {
			if (node.tagName !== "table" || parent === undefined || index === undefined) {
				return;
			}
			visit(node, "element", (cellChild: Element) => {
				if (cellChild.tagName === "code") {
					withIdentifierBreaks(cellChild);
				}
			});
			const wrapper: Element = { type: "element", tagName: "div", properties: { className: ["table-wrapper"] }, children: [node] };
			parent.children.splice(index, 1, wrapper);
		});
	};
}
