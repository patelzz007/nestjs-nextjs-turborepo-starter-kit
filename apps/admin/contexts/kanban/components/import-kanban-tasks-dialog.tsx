"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_SLOT_INDEX, newRowId, type KanbanBoardKind, type KanbanColumn } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { toastMessage } from "@workspace/ui/components/toast";
import { FileUp } from "lucide-react";
import * as React from "react";

import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";

import { readKanbanCsv, type KanbanCsvImport } from "../lib/kanban-csv-import";
import { KANBAN_BOARD_DISPLAY } from "../lib/kanban-display";

const IMPORT_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_COLUMN_FULL: "A column would hold too many items. Nothing was imported.",
	KANBAN_COLUMN_NOT_FOUND: "A column no longer exists. Reload the board and try again.",
	KANBAN_BOARD_MISMATCH: "A row is for the other board. Nothing was imported.",
	KANBAN_PARENT_INVALID: "A row names a parent that does not fit. Nothing was imported.",
};

/** The example the dialog shows for each board, in the header order the reader accepts. */
const CSV_EXAMPLE: Readonly<Record<KanbanBoardKind, string>> = {
	PLANNING:
		'title,type,description,priority,team,column,labels,start,due\nSelf-serve refunds,feature,Merchants refund a claim themselves,high,product,Backlog,"payments, q1",2026-11-02,2026-12-14',
	EXECUTION:
		'title,type,description,priority,team,column,labels,points,start,due\nRefund a card payment,story,Full refund to the original card,high,backend,To Do,"payments",5,2026-11-02,2026-11-16',
};

export interface ImportKanbanTasksDialogProps {
	readonly open: boolean;
	/** The board the rows go onto. */
	readonly board: KanbanBoardKind;
	/** The board's columns, left to right (a row's `column` names one by title). */
	readonly columns: readonly KanbanColumn[];
	readonly onClose: () => void;
}

/**
 * "Import CSV": reads the picked file in the browser, shows every row it
 * refuses, and — only when every row is valid — creates them all at once
 * (`POST /admin/kanban/tasks/import`, all or none), then shows the new board.
 */
export function ImportKanbanTasksDialog({ open, board, columns, onClose }: ImportKanbanTasksDialogProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const inputRef = React.useRef<HTMLInputElement>(null);
	const [fileName, setFileName] = React.useState<string | null>(null);
	const [parsed, setParsed] = React.useState<KanbanCsvImport | null>(null);
	const [idempotencyKey, setIdempotencyKey] = React.useState<string>(newRowId);

	const reset = React.useCallback((): void => {
		setFileName(null);
		setParsed(null);
		setIdempotencyKey(newRowId());
	}, []);

	const importTasks = api.kanban.importTasks.useIdempotentMutation({
		onSuccess: (response, call) => {
			queryClient.setQueryData(apiRouter.kanban.board.queryKey({ board: call.input.board }), response);
			toastMessage.success({ title: "Items imported", description: `${String(call.input.tasks.length)} items were added to the board.` });
			reset();
			onClose();
		},
		onError: (error) => {
			toastMutationError("Could not import the items", error, IMPORT_ERROR_MESSAGES);
		},
	});

	const handlePick = React.useCallback((): void => {
		inputRef.current?.click();
	}, []);

	const handleFile = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const file = event.target.files?.[LIST_SLOT_INDEX.first];
			event.target.value = "";
			if (file === undefined) {
				return;
			}
			setFileName(file.name);
			setIdempotencyKey(newRowId());
			void file.text().then(
				(text: string): void => {
					setParsed(readKanbanCsv(text, columns, board));
				},
				(): void => {
					setParsed({ kind: "invalid", problems: [{ line: 1, message: "The file could not be read." }] });
				},
			);
		},
		[board, columns],
	);

	const handleImport = React.useCallback((): void => {
		if (parsed?.kind === "ready") {
			importTasks.mutate({ input: { board, tasks: parsed.tasks }, idempotencyKey });
		}
	}, [board, idempotencyKey, importTasks, parsed]);

	const handleOpenChange = React.useCallback(
		(next: boolean): void => {
			if (!next) {
				reset();
				onClose();
			}
		},
		[onClose, reset],
	);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Import to the {KANBAN_BOARD_DISPLAY[board].label.toLowerCase()} board</DialogTitle>
					<DialogDescription>One item per row, after a header row. Only “title” is required; you report every item you import.</DialogDescription>
				</DialogHeader>
				<pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">{CSV_EXAMPLE[board]}</pre>
				<input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" aria-label="CSV file" onChange={handleFile} />
				<div className="flex flex-wrap items-center gap-3">
					<Button type="button" variant="outline" onClick={handlePick}>
						<FileUp data-icon="inline-start" />
						{fileName === null ? "Choose a CSV file" : "Choose another file"}
					</Button>
					{fileName === null ? null : <span className="truncate text-sm text-muted-foreground">{fileName}</span>}
				</div>
				{parsed?.kind === "invalid" ? (
					<ul role="alert" className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
						{parsed.problems.map((problem) => (
							<li key={`${String(problem.line)}:${problem.message}`}>
								Line {problem.line}: {problem.message}
							</li>
						))}
					</ul>
				) : null}
				{parsed?.kind === "ready" ? <p className="text-sm text-muted-foreground">{parsed.tasks.length} items are ready to import.</p> : null}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="button" disabled={parsed?.kind !== "ready" || importTasks.isPending} onClick={handleImport}>
						{importTasks.isPending ? "Importing…" : "Import items"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
