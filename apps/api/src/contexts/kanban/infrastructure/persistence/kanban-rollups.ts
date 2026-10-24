import type { KanbanItemType, KanbanRollup, KanbanTally } from "@workspace/shared";

/** One live item as the rollup reads it: its place in the hierarchy, its estimate and whether it is done. */
export interface KanbanRollupItem {
	readonly id: string;
	readonly type: KanbanItemType;
	readonly parentId: string | null;
	readonly storyPoints: number | null;
	readonly isDone: boolean;
}

const EMPTY: KanbanTally = { done: 0, total: 0 };

export const NO_ROLLUP: KanbanRollup = { children: EMPTY, points: EMPTY };

function add(left: KanbanTally, right: KanbanTally): KanbanTally {
	return { done: left.done + right.done, total: left.total + right.total };
}

/**
 * What every live item adds up from below, from one read of both boards: its
 * direct children (and how many are done), and the story points of every story
 * under it — a story counts its own, done when the story sits in a `DONE`
 * column. Points live only on stories, so nothing is counted twice.
 */
export function computeRollups(items: readonly KanbanRollupItem[]): ReadonlyMap<string, KanbanRollup> {
	const children = new Map<string, KanbanRollupItem[]>();
	for (const item of items) {
		if (item.parentId !== null) {
			children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
		}
	}
	const points = new Map<string, KanbanTally>();
	// The hierarchy is at most four levels deep and strictly typed downwards, so this never revisits an item.
	const pointsOf = (item: KanbanRollupItem): KanbanTally => {
		const known = points.get(item.id);
		if (known !== undefined) {
			return known;
		}
		const own: KanbanTally = item.type === "STORY" && item.storyPoints !== null ? { done: item.isDone ? item.storyPoints : 0, total: item.storyPoints } : EMPTY;
		const total = item.type === "STORY" ? own : (children.get(item.id) ?? []).reduce((sum, child) => add(sum, pointsOf(child)), EMPTY);
		points.set(item.id, total);
		return total;
	};
	return new Map(
		items.map((item): [string, KanbanRollup] => {
			const direct = children.get(item.id) ?? [];
			return [item.id, { children: { done: direct.filter((child) => child.isDone).length, total: direct.length }, points: pointsOf(item) }];
		}),
	);
}
