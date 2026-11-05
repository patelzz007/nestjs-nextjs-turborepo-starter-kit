import { Alert, AlertDescription, AlertTitle, type AlertVariant } from "@workspace/ui/components/alert";
import type { Element, ElementContent, Root } from "hast";
import { toString } from "hast-util-to-string";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { visit } from "unist-util-visit";
import { z } from "zod";

import { QuoteKindSchema, type QuoteKind } from "./remark-plugins";

/**
 * Callouts (`> [!WARNING]`, and plain quotes `remarkCallouts` classified) → the shared `Alert` from
 * `@workspace/ui`, the same component web, merchant and admin use, so a docs callout and an app notice can
 * never drift apart. The Alert is rendered once at build time with a placeholder in its description and split
 * there into two raw HTML pieces, with the callout's own content (lists, code blocks, links) in between;
 * `rehype-raw`, which runs after this plugin (src/pipeline.ts), joins them back into one element, the way it
 * joins a `<details>` opened and closed in separate Markdown blocks. (Parsing the markup into hast instead
 * would need hast-util-from-parse5, whose types make `ElementData.position` required for every element.)
 *
 * A callout is part of the reading text, not a live message, so it gets `role="note"` rather than the
 * Alert's default `role="alert"` (which a screen reader would announce on page load).
 */

/** Which Alert variant draws each callout kind. */
export const CALLOUT_VARIANTS: Readonly<Record<QuoteKind, AlertVariant>> = {
	info: "info",
	tip: "success",
	success: "success",
	warning: "warning",
	error: "destructive",
};

const CLASS_LIST_SCHEMA = z.array(z.union([z.string(), z.number()]));
const CALLOUT_CLASS = "callout";
const TITLE_CLASS = "callout-title";
/** Stands in for the callout's content while the Alert renders (private-use characters, which React never escapes); never reaches a page. */
const CONTENT_PLACEHOLDER = "\uE000callout-content\uE000";

function hasClass(node: Element, className: string): boolean {
	const classes = CLASS_LIST_SCHEMA.safeParse(node.properties.className);
	return classes.success && classes.data.some((name) => String(name) === className);
}

/**
 * The callout kind on `data-kind`; `info` when absent. `remarkCallouts` sets it through `hProperties`, which
 * remark → hast copies verbatim (`"data-kind"`); HTML parsed into hast spells it `dataKind`. Both are read.
 */
export function calloutKind(node: Element): QuoteKind {
	const kind = QuoteKindSchema.safeParse(node.properties["data-kind"] ?? node.properties.dataKind);
	return kind.success ? kind.data : "info";
}

/** The callout's title paragraph (`p.callout-title`): its first element child, past the newlines between blocks. */
function titleParagraph(node: Element): Element | null {
	const first = node.children.find((child): child is Element => child.type === "element");
	return first?.tagName === "p" && hasClass(first, TITLE_CLASS) ? first : null;
}

function calloutElement(variant: AlertVariant, title: string | null): ReactElement {
	return createElement(
		Alert,
		{ variant, role: "note", className: CALLOUT_CLASS },
		title === null ? null : createElement(AlertTitle, null, title),
		createElement(AlertDescription, null, CONTENT_PLACEHOLDER),
	);
}

/** The callout as the Alert: its opening markup, the callout's content, then its closing markup. */
export function calloutToAlert(node: Element): readonly ElementContent[] {
	const titleNode = titleParagraph(node);
	const title = titleNode === null ? null : toString(titleNode);
	const content = node.children.filter((child) => child !== titleNode);
	const [opening, closing, ...extra] = renderToStaticMarkup(calloutElement(CALLOUT_VARIANTS[calloutKind(node)], title)).split(CONTENT_PLACEHOLDER);
	if (opening === undefined || closing === undefined || extra.length > 0) {
		throw new Error("The Alert did not render its description exactly once, so a callout's content had nowhere to go.");
	}
	return [{ type: "raw", value: opening }, ...content, { type: "raw", value: closing }];
}

/** Rehype plugin: every `<aside class="callout">` from `remarkCallouts` becomes the shared Alert. */
export function rehypeCalloutAlert(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "element", (node: Element, index, parent) => {
			if (node.tagName !== "aside" || !hasClass(node, CALLOUT_CLASS) || index === undefined || parent === undefined) {
				return;
			}
			parent.children.splice(index, 1, ...calloutToAlert(node));
		});
	};
}
