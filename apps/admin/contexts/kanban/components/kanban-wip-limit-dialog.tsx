"use client";

import { KANBAN_COLUMN_TASK_LIMIT, LIST_SLOT_INDEX } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import * as React from "react";
import { z } from "zod";

/** A typed limit: blank clears it, otherwise a whole number of items the column can hold. */
const WipLimitInputSchema = z
	.string()
	.trim()
	.transform((text): number | null => (text.length === 0 ? null : Number(text)))
	.pipe(
		z
			.number()
			.int("Enter a whole number")
			.min(1, "At least 1")
			.max(KANBAN_COLUMN_TASK_LIMIT, `At most ${String(KANBAN_COLUMN_TASK_LIMIT)}`)
			.nullable(),
	);

export interface KanbanWipLimitTarget {
	readonly columnId: string;
	readonly title: string;
	readonly wipLimit: number | null;
}

interface WipLimitFormProps {
	readonly target: KanbanWipLimitTarget;
	readonly isPending: boolean;
	readonly onSave: (columnId: string, wipLimit: number | null) => void;
	readonly onClose: () => void;
}

/** The limit's input, starting from the column's current limit (remounted per column). */
function WipLimitForm({ target, isPending, onSave, onClose }: WipLimitFormProps): React.JSX.Element {
	const [text, setText] = React.useState(target.wipLimit === null ? "" : String(target.wipLimit));
	const [error, setError] = React.useState<string | null>(null);
	const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setText(event.target.value);
	}, []);
	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const parsed = WipLimitInputSchema.safeParse(text);
			if (!parsed.success) {
				setError(parsed.error.issues.at(LIST_SLOT_INDEX.first)?.message ?? "Enter a whole number");
				return;
			}
			onSave(target.columnId, parsed.data);
		},
		[onSave, target.columnId, text],
	);
	return (
		<form noValidate className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-1.5">
				<Label htmlFor="kanban-wip-limit">Most items in the column</Label>
				<Input id="kanban-wip-limit" inputMode="numeric" value={text} aria-invalid={error !== null} onChange={handleChange} placeholder="No limit" />
				{error === null ? null : (
					<p role="alert" className="text-sm text-destructive">
						{error}
					</p>
				)}
			</div>
			<DialogFooter>
				<Button type="button" variant="outline" onClick={onClose}>
					Cancel
				</Button>
				<Button type="submit" disabled={isPending}>
					{isPending ? "Saving…" : "Save limit"}
				</Button>
			</DialogFooter>
		</form>
	);
}

export interface KanbanWipLimitDialogProps {
	/** The column being limited; `null` keeps the dialog closed. */
	readonly target: KanbanWipLimitTarget | null;
	readonly isPending: boolean;
	readonly onSave: (columnId: string, wipLimit: number | null) => void;
	readonly onClose: () => void;
}

/** "Set WIP limit": a soft limit the column header warns about; blank removes it. */
export function KanbanWipLimitDialog({ target, isPending, onSave, onClose }: KanbanWipLimitDialogProps): React.JSX.Element {
	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			if (!open) {
				onClose();
			}
		},
		[onClose],
	);
	return (
		<Dialog open={target !== null} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>WIP limit for {target?.title ?? "the column"}</DialogTitle>
					<DialogDescription>The column warns once it holds more items. Leave blank for no limit.</DialogDescription>
				</DialogHeader>
				{target === null ? null : <WipLimitForm key={target.columnId} target={target} isPending={isPending} onSave={onSave} onClose={onClose} />}
			</DialogContent>
		</Dialog>
	);
}
