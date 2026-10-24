"use client";

import { KANBAN_CHILD_TYPE, type KanbanTask } from "@workspace/shared";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import * as React from "react";

import { KANBAN_TYPE_DISPLAY } from "../lib/kanban-display";
import { KanbanLevelChip } from "./kanban-task-badges";

/** An item moving into a done column while work under it is still open. */
export interface KanbanFinishWarning {
	readonly task: KanbanTask;
	/** What the move finishes it as: Delivered on the planning board, Done on the execution board. */
	readonly finish: "Delivered" | "Done";
	/** Children not done yet. */
	readonly open: number;
}

/** The warning a move into a done column raises, or `null` when nothing under the item is still open. */
export function finishWarningFor(task: KanbanTask, finish: KanbanFinishWarning["finish"]): KanbanFinishWarning | null {
	const open = task.rollup.children.total - task.rollup.children.done;
	return open > 0 ? { task, finish, open } : null;
}

export interface KanbanFinishWarningDialogProps {
	readonly warning: KanbanFinishWarning | null;
	readonly onConfirm: () => void;
	readonly onCancel: () => void;
}

/**
 * "FEATURE-12 still has 2 open stories": marking an item Done (or a planning
 * item Delivered) with work open under it is allowed — the team may be closing
 * it out on purpose — but never by accident.
 */
export function KanbanFinishWarningDialog({ warning, onConfirm, onCancel }: KanbanFinishWarningDialogProps): React.JSX.Element {
	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			if (!open) {
				onCancel();
			}
		},
		[onCancel],
	);
	const childType = warning === null ? null : KANBAN_CHILD_TYPE[warning.task.type];
	const childLabel = childType === null ? "items" : (warning?.open === 1 ? KANBAN_TYPE_DISPLAY[childType].label : KANBAN_TYPE_DISPLAY[childType].plural).toLowerCase();
	return (
		<AlertDialog open={warning !== null} onOpenChange={handleOpenChange}>
			<AlertDialogContent className="sm:max-w-md">
				<AlertDialogHeader>
					<AlertDialogTitle>Mark it {warning?.finish.toLowerCase() ?? "done"} with work still open?</AlertDialogTitle>
					<AlertDialogDescription render={<div />} className="flex flex-col gap-2">
						{warning === null ? null : (
							<>
								<span className="flex min-w-0 items-center gap-2 text-foreground">
									<KanbanLevelChip type={warning.task.type} itemKey={warning.task.key} />
									<span className="truncate">{warning.task.title}</span>
								</span>
								<span>
									It still has {String(warning.open)} open {childLabel}. They stay open where they are.
								</span>
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep it open</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>Mark {warning?.finish.toLowerCase() ?? "done"}</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
