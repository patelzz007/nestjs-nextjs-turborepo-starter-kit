"use client";

// ============================================
// contexts/kanban/lib/use-move-to-parent.ts - Move to…, with Undo
// ============================================
// The one way an item changes parent: `POST …/tasks/:id/parent` at the version
// the client read. The answer replaces the cached item; both boards and the old
// and new parents' pages reload (their children and rollups changed). A toast
// names where the item went — "Moved to FEATURE-12" — with an Undo that sends
// the same call back at the version the move answered.

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { Envelope, KanbanItemRef, KanbanTaskDetail } from "@workspace/shared";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";

import { invalidateKanban } from "./kanban-cache";

/** How long the Undo stays offered: long enough to notice a slip, short enough not to linger. */
export const KANBAN_MOVE_UNDO_MS = 10_000;

const MOVE_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_TASK_STALE: "Someone else changed this item first. Reload it and try again.",
	KANBAN_PARENT_INVALID: "That parent is not one level up any more. Pick another.",
	KANBAN_ITEM_RULE_VIOLATED: "This item needs a parent at its level.",
};

/** The item being moved, as the board or its page last read it. */
export interface KanbanMoveSubject {
	readonly id: string;
	readonly version: number;
	readonly parentId: string | null;
	/** Its current parent, so Undo can name where it goes back to. */
	readonly parent: KanbanItemRef | null;
}

/** How an item reads in a toast: its key, or its title when it has none yet. */
export function itemLabel(item: KanbanItemRef | null): string {
	if (item === null) {
		return "no parent";
	}
	return item.key ?? item.title;
}

export interface KanbanMoveToParent {
	/** Moves `subject` under `target` (`null`: under none); resolves with the item as it now stands. */
	readonly move: (subject: KanbanMoveSubject, target: KanbanItemRef | null) => Promise<KanbanTaskDetail | null>;
	readonly isPending: boolean;
}

/** Move to… for any caller (a card's menu, the item page, the command palette). */
export function useMoveToParent(): KanbanMoveToParent {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const onError = React.useCallback((error: Error): void => {
		toastMutationError("Could not move the item", error, MOVE_ERROR_MESSAGES);
	}, []);
	const mutation = api.kanban.moveToParent.useMutation({ onError });

	const send = React.useCallback(
		async (subject: KanbanMoveSubject, target: KanbanItemRef | null): Promise<KanbanTaskDetail | null> => {
			try {
				const response: Envelope<KanbanTaskDetail> = await mutation.mutateAsync({ taskId: subject.id, parentId: target?.id ?? null, version: subject.version });
				queryClient.setQueryData(apiRouter.kanban.task.queryKey({ taskId: subject.id }), response);
				await invalidateKanban(queryClient, [subject.id, subject.parentId, target?.id ?? null]);
				return response.data;
			} catch {
				// `onError` has told the person why; the caller keeps the item where it was.
				return null;
			}
		},
		[mutation, queryClient],
	);

	const move = React.useCallback(
		async (subject: KanbanMoveSubject, target: KanbanItemRef | null): Promise<KanbanTaskDetail | null> => {
			const moved = await send(subject, target);
			if (moved === null) {
				return null;
			}
			const undo = (): void => {
				void send({ id: moved.id, version: moved.version, parentId: moved.parentId, parent: target }, subject.parent).then((back): void => {
					if (back !== null) {
						toastMessage.info({ title: `Moved back to ${itemLabel(subject.parent)}` });
					}
				});
			};
			toastMessage.success({ title: `Moved to ${itemLabel(target)}`, timeout: KANBAN_MOVE_UNDO_MS, actionProps: { children: "Undo", onClick: undo } });
			return moved;
		},
		[send],
	);

	return { move, isPending: mutation.isPending };
}
