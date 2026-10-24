"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { ApiErrorCodes, kanbanTypesOnBoard, newRowId, type CreateKanbanTaskInput, type KanbanBoardKind } from "@workspace/shared";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { toastMessage } from "@workspace/ui/components/toast";
import * as React from "react";

import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";

import { invalidateKanban } from "../lib/kanban-cache";
import { KANBAN_BOARD_DISPLAY, KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import type { KanbanTaskFormValues } from "../lib/kanban-task-form";
import type { KanbanColumnHeading } from "./kanban-board-columns";
import { KanbanTaskForm } from "./kanban-task-form";

const CREATE_TASK_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_COLUMN_FULL: "That column is full. Move or delete an item there first.",
	KANBAN_COLUMN_NOT_FOUND: "That column no longer exists. Reload the board.",
	KANBAN_BOARD_MISMATCH: "That column is on the other board.",
	KANBAN_PARENT_INVALID: "Choose a parent one level up.",
	KANBAN_ASSIGNEE_INVALID: "That person cannot use the board.",
	[ApiErrorCodes.FORBIDDEN]: "You may not create items.",
};

export interface CreateKanbanTaskDialogProps {
	/** The form's starting values; `null` keeps the dialog closed. */
	readonly draft: KanbanTaskFormValues | null;
	/** The board the item goes onto (its columns and the levels it may be). */
	readonly board: KanbanBoardKind;
	readonly columns: readonly KanbanColumnHeading[];
	/** The preset parent's title, when the dialog opens from the parent's page. */
	readonly parentLabel?: string | undefined;
	readonly onClose: () => void;
}

/**
 * "Add …": the item form in a dialog. `POST /admin/kanban/tasks` with one
 * Idempotency-Key per draft (a retry never creates the item twice), then both
 * boards and the parent's page reload with the new item.
 */
export function CreateKanbanTaskDialog({ draft, board, columns, parentLabel, onClose }: CreateKanbanTaskDialogProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const [idempotencyKey, setIdempotencyKey] = React.useState<string>(newRowId);
	const types = React.useMemo(() => kanbanTypesOnBoard(board), [board]);
	const createTask = api.kanban.createTask.useIdempotentMutation({
		onSuccess: async (response) => {
			setIdempotencyKey(newRowId());
			await invalidateKanban(queryClient, [response.data.parentId]);
			toastMessage.success({ title: `${KANBAN_TYPE_DISPLAY[response.data.type].label} created`, description: response.data.title });
			onClose();
		},
		onError: (error) => {
			toastMutationError("Could not create the item", error, CREATE_TASK_ERROR_MESSAGES);
		},
	});

	const handleSubmit = React.useCallback(
		(input: CreateKanbanTaskInput): void => {
			createTask.mutate({ input, idempotencyKey });
		},
		[createTask, idempotencyKey],
	);
	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			if (!open) {
				onClose();
			}
		},
		[onClose],
	);
	const title = draft === null ? "Add item" : `Add ${KANBAN_TYPE_DISPLAY[draft.type].label.toLowerCase()}`;

	return (
		<Dialog open={draft !== null} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>On the {KANBAN_BOARD_DISPLAY[board].label.toLowerCase()} board, at the bottom of its column. You report it and watch it.</DialogDescription>
				</DialogHeader>
				{draft === null ? null : (
					<KanbanTaskForm
						initialValues={draft}
						columns={columns}
						types={types}
						parentLabel={parentLabel}
						submitLabel="Create"
						isPending={createTask.isPending}
						onSubmit={handleSubmit}
						onCancel={onClose}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
