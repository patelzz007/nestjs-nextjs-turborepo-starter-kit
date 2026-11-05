import { ISLAND_PROPS_ATTRIBUTE, ISLAND_ROOT_ATTRIBUTE } from "@workspace/docs-renderer/code-block/render";
import { MEDIA_ISLAND_PAYLOAD_ATTRIBUTE, MEDIA_ISLAND_ROOT_ATTRIBUTE } from "@workspace/docs-renderer/media/render";
import type { ReactElement } from "react";
import type { Root } from "react-dom/client";

/**
 * Hydrates the article's build-time islands — every code block (the `@workspace/ui` CodeBlock) and media
 * embed (`ImageCarousel` / `ImageResizer`) — into the live components. The article body is HTML from the
 * docs renderer, so each island is its own React root inside it, exactly as under the Astro site; the
 * components are imported only on pages that have one. Returns a cleanup that unmounts every root, for
 * when the article is replaced (client navigation).
 */

/** One kind of island: how to find its containers and turn a container's payload into its element. */
export interface IslandKind {
	readonly rootAttribute: string;
	readonly payloadAttribute: string;
	readonly load: () => Promise<(payload: string) => ReactElement>;
}

export const CODE_BLOCK_ISLANDS: IslandKind = {
	rootAttribute: ISLAND_ROOT_ATTRIBUTE,
	payloadAttribute: ISLAND_PROPS_ATTRIBUTE,
	load: async (): Promise<(payload: string) => ReactElement> => {
		const [{ docsCodeBlockElement }, { parseProps }] = await Promise.all([
			import("@workspace/docs-renderer/code-block/element"),
			import("@workspace/docs-renderer/code-block/props"),
		]);
		return (payload: string): ReactElement => docsCodeBlockElement(parseProps(payload));
	},
};

export const MEDIA_ISLANDS: IslandKind = {
	rootAttribute: MEDIA_ISLAND_ROOT_ATTRIBUTE,
	payloadAttribute: MEDIA_ISLAND_PAYLOAD_ATTRIBUTE,
	load: async (): Promise<(payload: string) => ReactElement> => {
		const [{ docsMediaIslandElement }, { parseMediaIslandPayload }] = await Promise.all([
			import("@workspace/docs-renderer/media/element"),
			import("@workspace/docs-renderer/media/props"),
		]);
		return (payload: string): ReactElement => docsMediaIslandElement(parseMediaIslandPayload(payload));
	},
};

interface PendingIsland {
	readonly container: HTMLElement;
	readonly payload: string;
}

function pendingIslands(root: ParentNode, kind: IslandKind): readonly PendingIsland[] {
	return [...root.querySelectorAll<HTMLElement>(`[${kind.rootAttribute}]`)].flatMap((container): PendingIsland[] => {
		const payload = container.parentElement?.querySelector(`script[${kind.payloadAttribute}]`)?.textContent;
		return payload === undefined || container.dataset.hydrated === "true" ? [] : [{ container, payload }];
	});
}

/** One island React now owns: its root, and the container to release when it unmounts. */
export interface MountedIsland {
	readonly root: Root;
	readonly container: HTMLElement;
}

/**
 * Brings every island of `kinds` inside `root` to life; resolves to the islands it mounted. A container still
 * holding its build-time markup is hydrated; one that was emptied (its island unmounted earlier) is rendered
 * fresh. Once `signal` aborts, nothing more is mounted — the component that asked has already gone, and a
 * late mount would fight the next one over the same containers.
 */
export async function hydrateIslands(
	root: ParentNode,
	kinds: readonly IslandKind[] = [CODE_BLOCK_ISLANDS, MEDIA_ISLANDS],
	signal?: AbortSignal,
): Promise<readonly MountedIsland[]> {
	const { createRoot, hydrateRoot } = await import("react-dom/client");
	const mounted: MountedIsland[] = [];
	for (const kind of kinds) {
		const islands = pendingIslands(root, kind);
		if (islands.length === 0) {
			continue;
		}
		const element = await kind.load();
		if (signal?.aborted === true) {
			return mounted;
		}
		for (const { container, payload } of islands) {
			if (container.childElementCount > 0) {
				mounted.push({ root: hydrateRoot(container, element(payload)), container });
			} else {
				const fresh = createRoot(container);
				fresh.render(element(payload));
				mounted.push({ root: fresh, container });
			}
			container.dataset.hydrated = "true";
		}
	}
	return mounted;
}

/**
 * Mounts the islands in `root` and returns the cleanup, which cancels a mount still loading and unmounts the
 * islands already live. Safe when React runs an effect twice (development) or the reader navigates away
 * before the islands load. A failure leaves the server-rendered markup readable.
 */
export function mountIslands(root: ParentNode): () => void {
	const controller = new AbortController();
	const mounted = hydrateIslands(root, undefined, controller.signal).catch((error: unknown): readonly MountedIsland[] => {
		// The server-rendered blocks stay readable; only their buttons stay inert.
		console.error("[docs] islands could not be hydrated", error);
		return [];
	});
	return (): void => {
		if (controller.signal.aborted) {
			return;
		}
		controller.abort();
		void mounted.then((islands) => {
			for (const island of islands) {
				island.root.unmount();
				delete island.container.dataset.hydrated;
			}
		});
	};
}
