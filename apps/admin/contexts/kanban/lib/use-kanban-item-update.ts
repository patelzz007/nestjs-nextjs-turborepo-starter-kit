"use client";

// ============================================
// contexts/kanban/lib/use-kanban-item-update.ts - after a change that answers the item
// ============================================
// Linking, unlinking, ticking a checklist row, watching and unwatching each
// answer the item's detail: it replaces the cached item at once, then the
// item's history and both boards (rollups, "blocked" badges, counts) reload.

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import type { Envelope, KanbanTaskDetail } from "@workspace/shared";
import * as React from "react";

import { invalidateKanbanBoards } from "./kanban-cache";

/** The `onSuccess` of a mutation that answers `taskId`'s detail. */
export function useKanbanItemUpdate(taskId: string): (response: Envelope<KanbanTaskDetail>) => Promise<void> {
	const queryClient = useQueryClient();
	return React.useCallback(
		async (response: Envelope<KanbanTaskDetail>): Promise<void> => {
			queryClient.setQueryData(apiRouter.kanban.task.queryKey({ taskId }), response);
			await Promise.all([queryClient.invalidateQueries({ queryKey: apiRouter.kanban.activity.scopeKey({ taskId }) }), invalidateKanbanBoards(queryClient)]);
		},
		[queryClient, taskId],
	);
}
