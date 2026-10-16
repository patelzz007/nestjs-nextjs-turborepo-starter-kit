import { hydrateRoot } from "react-dom/client";

import { docsMediaIslandElement } from "@/lib/media/element";
import { parseMediaIslandPayload } from "@/lib/media/props";
import { MEDIA_ISLAND_PAYLOAD_ATTRIBUTE, MEDIA_ISLAND_ROOT_ATTRIBUTE } from "@/lib/media/render";

/**
 * Hydrates every server-rendered media island on the page (```carousel and ```image-resize
 * fences) into the live `@workspace/ui` component. Loaded on demand by `media-islands.ts`, so
 * pages without one never download React or Embla.
 */
export function hydrateMediaIslands(root: ParentNode = document): number {
	let hydrated = 0;
	for (const container of root.querySelectorAll<HTMLElement>(`[${MEDIA_ISLAND_ROOT_ATTRIBUTE}]`)) {
		const payload = container.parentElement?.querySelector(`script[${MEDIA_ISLAND_PAYLOAD_ATTRIBUTE}]`)?.textContent;
		if (payload === undefined || container.dataset.hydrated === "true") {
			continue;
		}
		hydrateRoot(container, docsMediaIslandElement(parseMediaIslandPayload(payload)));
		container.dataset.hydrated = "true";
		hydrated += 1;
	}
	return hydrated;
}
