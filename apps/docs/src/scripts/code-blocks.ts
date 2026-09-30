import { ISLAND_ROOT_ATTRIBUTE } from "@/lib/code-block/render";

/** Loads React + the code block only on pages that contain code blocks. */
export function initCodeBlocks(load: () => Promise<{ hydrateCodeBlocks: () => number }> = () => import("./code-block-hydrate")): void {
	if (document.querySelector(`[${ISLAND_ROOT_ATTRIBUTE}]`) === null) {
		return;
	}
	load()
		.then(({ hydrateCodeBlocks }) => {
			hydrateCodeBlocks();
		})
		.catch((error: unknown) => {
			// The server-rendered blocks stay readable; only their buttons stay inert.
			console.error("[docs] code blocks could not be hydrated", error);
		});
}
