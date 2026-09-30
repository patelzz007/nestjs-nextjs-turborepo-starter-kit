import { hydrateRoot } from "react-dom/client";

import { docsCodeBlockElement } from "@/lib/code-block/element";
import { parseProps } from "@/lib/code-block/props";
import { ISLAND_PROPS_ATTRIBUTE, ISLAND_ROOT_ATTRIBUTE } from "@/lib/code-block/render";

/**
 * Hydrates every server-rendered code block on the page into the live
 * `@workspace/ui` CodeBlock. Loaded on demand by `code-blocks.ts`, so pages
 * without code never download React.
 */
export function hydrateCodeBlocks(root: ParentNode = document): number {
	let hydrated = 0;
	for (const container of root.querySelectorAll<HTMLElement>(`[${ISLAND_ROOT_ATTRIBUTE}]`)) {
		const payload = container.parentElement?.querySelector(`script[${ISLAND_PROPS_ATTRIBUTE}]`)?.textContent;
		if (payload === undefined || container.dataset.hydrated === "true") {
			continue;
		}
		hydrateRoot(container, docsCodeBlockElement(parseProps(payload)));
		container.dataset.hydrated = "true";
		hydrated += 1;
	}
	return hydrated;
}
