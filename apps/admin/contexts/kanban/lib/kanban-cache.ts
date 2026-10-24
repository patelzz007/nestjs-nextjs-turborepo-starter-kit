// ============================================
// contexts/kanban/lib/kanban-cache.ts - what an item change makes stale
// ============================================
// An item's change can move a card, a rollup or a "blocked" badge on either
// board, and changes its parent's children too — so both boards reload, and so
// does every item page the change reaches (with its comments and history).

import type { QueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { KanbanBoardKindSchema } from "@workspace/shared";

/** Both boards. */
export async function invalidateKanbanBoards(queryClient: QueryClient): Promise<void> {
	await Promise.all(KanbanBoardKindSchema.options.map((board) => queryClient.invalidateQueries({ queryKey: apiRouter.kanban.board.scopeKey({ board }) })));
}

/** Both boards and the pages of `taskIds` (`null`s skipped: an item without a parent). */
export async function invalidateKanban(queryClient: QueryClient, taskIds: readonly (string | null)[]): Promise<void> {
	const pages = [...new Set(taskIds.flatMap((taskId) => (taskId === null ? [] : [taskId])))];
	await Promise.all([invalidateKanbanBoards(queryClient), ...pages.map((taskId) => queryClient.invalidateQueries({ queryKey: apiRouter.kanban.task.scopeKey({ taskId }) }))]);
}
