import { renderToString } from "react-dom/server";

import { docsMediaIslandElement } from "./element";
import { serializeMediaIslandPayload, type MediaIslandPayload } from "./props";

/** Marks the element React hydrates; its sibling script carries the payload. */
export const MEDIA_ISLAND_ROOT_ATTRIBUTE = "data-media-island-root";
export const MEDIA_ISLAND_PAYLOAD_ATTRIBUTE = "data-media-island-payload";

/**
 * Build-time HTML for one media island: the server-rendered component (the images show before
 * any JavaScript runs) plus its payload as JSON, so `src/scripts/media-island-hydrate.ts` can
 * hydrate it into the live, interactive component.
 */
export function renderMediaIsland(payload: MediaIslandPayload): string {
	const html = renderToString(docsMediaIslandElement(payload));
	return (
		`<div class="media-island media-island-${payload.kind}"><div ${MEDIA_ISLAND_ROOT_ATTRIBUTE}>${html}</div>` +
		`<script type="application/json" ${MEDIA_ISLAND_PAYLOAD_ATTRIBUTE}>${serializeMediaIslandPayload(payload)}</script></div>`
	);
}
