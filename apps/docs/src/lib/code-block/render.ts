import { renderToString } from "react-dom/server";

import { docsCodeBlockElement } from "./element";
import { serializeProps, type DocsCodeBlockProps } from "./props";

/** Marks the element React hydrates; its sibling script carries the props. */
export const ISLAND_ROOT_ATTRIBUTE = "data-code-block-root";
export const ISLAND_PROPS_ATTRIBUTE = "data-code-block-props";

/**
 * Build-time HTML for one code block: the server-rendered component (visible
 * and readable before any JavaScript runs) plus its props as JSON, so
 * `src/scripts/code-block-hydrate.ts` can hydrate it into the live component.
 */
export function renderCodeBlockIsland(props: DocsCodeBlockProps): string {
	const html = renderToString(docsCodeBlockElement(props));
	return `<div class="code-block-island"><div ${ISLAND_ROOT_ATTRIBUTE}>${html}</div><script type="application/json" ${ISLAND_PROPS_ATTRIBUTE}>${serializeProps(props)}</script></div>`;
}
