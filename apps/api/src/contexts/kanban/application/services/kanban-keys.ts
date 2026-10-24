import type { KanbanItemType } from "@workspace/shared";

import type { KanbanKeyRepository } from "../../domain/repositories/kanban.repositories";

/** The next key of `type` (`STORY-143`), from the level's counter in the caller's transaction. */
export async function nextKey(keys: KanbanKeyRepository, type: KanbanItemType): Promise<string> {
	const [key] = await keys.next(type, 1);
	if (key === undefined) {
		throw new Error(`The ${type} counter handed out no key.`);
	}
	return key;
}

/** An item of a batch and the key it was handed. */
export interface KeyedItem<TItem> {
	readonly item: TItem;
	readonly key: string;
}

/**
 * Each item with its key, in the items' order: each level's counter is advanced
 * once by how many items of that level there are, so an import of 40 stories is
 * one counter write, not 40.
 */
export async function withKeys<TItem extends { readonly type: KanbanItemType }>(keys: KanbanKeyRepository, items: readonly TItem[]): Promise<readonly KeyedItem<TItem>[]> {
	const byType = new Map<KanbanItemType, string[]>();
	for (const type of new Set(items.map((item) => item.type))) {
		byType.set(type, [...(await keys.next(type, items.filter((item) => item.type === type).length))]);
	}
	return items.map((item): KeyedItem<TItem> => {
		const key = byType.get(item.type)?.shift();
		if (key === undefined) {
			throw new Error(`The ${item.type} counter handed out too few keys.`);
		}
		return { item, key };
	});
}
