import { MEDIA_ISLAND_ROOT_ATTRIBUTE } from "@/lib/media/render";

/** Loads React and the media components only on pages that contain a carousel or a resizable image. */
export function initMediaIslands(load: () => Promise<{ hydrateMediaIslands: () => number }> = () => import("./media-island-hydrate")): void {
	if (document.querySelector(`[${MEDIA_ISLAND_ROOT_ATTRIBUTE}]`) === null) {
		return;
	}
	load()
		.then(({ hydrateMediaIslands }) => {
			hydrateMediaIslands();
		})
		.catch((error: unknown) => {
			// The server-rendered images stay visible; only swiping and resizing stay inert.
			console.error("[docs] media islands could not be hydrated", error);
		});
}
