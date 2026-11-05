"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { LIST_SLOT_INDEX, newRowId, type KanbanBoardKind, type KanbanColumn, type KanbanImportReport } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { toastMessage } from "@workspace/ui/components/toast";
import { FileUp } from "lucide-react";
import * as React from "react";

import { toastMutationError, type MutationErrorMessages } from "@/lib/api/mutation-error";

import { readKanbanCsv, type KanbanCsvImport, type KanbanCsvTask } from "../lib/kanban-csv-import";
import { KANBAN_BOARD_DISPLAY } from "../lib/kanban-display";

/** The whole import refused (the board changed since its dry run): nothing landed. */
const IMPORT_ERROR_MESSAGES: MutationErrorMessages = {
	KANBAN_ASSIGNEE_INVALID: "A row is assigned to someone who can't use the board. Nothing was imported.",
	KANBAN_COLUMN_FULL: "A column would hold too many items. Nothing was imported.",
	KANBAN_COLUMN_NOT_FOUND: "A column no longer exists. Reload the board and try again.",
	KANBAN_BOARD_MISMATCH: "A row is for the other board. Nothing was imported.",
	KANBAN_PARENT_INVALID: "A row names a parent that does not fit. Nothing was imported.",
};

/** Why the dry run skips one row, in that row's words. */
const ROW_PROBLEM_MESSAGES: MutationErrorMessages = {
	KANBAN_ASSIGNEE_INVALID: "The person it is assigned to can't use the board.",
	KANBAN_COLUMN_FULL: "Its column would hold too many items.",
	KANBAN_COLUMN_NOT_FOUND: "Its column no longer exists. Reload the board and try again.",
	KANBAN_BOARD_MISMATCH: "It is for the other board.",
	KANBAN_PARENT_INVALID: "It names a parent that does not fit.",
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

/** One line of the report: a row that will be skipped, and why. */
interface SkippedRow {
	readonly line: number;
	readonly message: string;
}

/**
 * The file's report once the server has checked it (enhancement 5.8): the rows that will import, and every row
 * that will be skipped (refused in the browser, or by the board itself in the dry run), by file line.
 */
export interface KanbanImportPlan {
	readonly importable: readonly KanbanCsvTask[];
	readonly skipped: readonly SkippedRow[];
}

/** Joins the browser's read with the server's dry run: a row the server refused is skipped too, named by its line. */
export function planKanbanImport(read: KanbanCsvImport, report: KanbanImportReport | null): KanbanImportPlan {
	const refused = new Map((report?.problems ?? []).map((problem) => [problem.row, problem]));
	const importable = read.tasks.filter((_task, row) => !refused.has(row));
	const serverSkipped = read.tasks.flatMap((task, row): SkippedRow[] => {
		const problem = refused.get(row);
		return problem === undefined ? [] : [{ line: task.line, message: ROW_PROBLEM_MESSAGES[problem.code] ?? problem.message }];
	});
	const skipped: SkippedRow[] = [...read.problems, ...serverSkipped];
	skipped.sort((left, right) => left.line - right.line);
	return { importable, skipped };
}

/** The import button's words: what pressing it does. */
export function importLabel(plan: KanbanImportPlan): string {
	const count = plan.importable.length;
	const items = count === 1 ? "1 item" : `${String(count)} items`;
	return plan.skipped.length === 0 ? `Import ${items}` : `Import ${items}, skip ${String(plan.skipped.length)}`;
}

/**
 * "Import CSV" (enhancement 5.8): reads the picked file in the browser, asks the board for a dry run of the rows
 * that read cleanly (`POST /admin/kanban/tasks/import/dry-run`: full columns, parents, assignees), and lists every
 * row that will be skipped and why. Importing then sends only the good rows (`POST /admin/kanban/tasks/import`,
 * all of those or none, so a batch never half-lands) and shows the new board.
 */
export function ImportKanbanTasksDialog({ open, board, columns, onClose }: ImportKanbanTasksDialogProps): React.JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const inputRef = React.useRef<HTMLInputElement>(null);
	const [fileName, setFileName] = React.useState<string | null>(null);
	const [read, setRead] = React.useState<KanbanCsvImport | null>(null);
	const [report, setReport] = React.useState<KanbanImportReport | null>(null);
	const [idempotencyKey, setIdempotencyKey] = React.useState<string>(newRowId);

	const reset = React.useCallback((): void => {
		setFileName(null);
		setRead(null);
		setReport(null);
		setIdempotencyKey(newRowId());
	}, []);

	const preview = api.kanban.previewImport.useMutation({
		onSuccess: (response): void => {
			setReport(response.data);
		},
		onError: (error): void => {
			toastMutationError("Could not check the file", error, IMPORT_ERROR_MESSAGES);
		},
	});

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

	const { mutate: runPreview } = preview;
	const handleFile = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const file = event.target.files?.[LIST_SLOT_INDEX.first];
			event.target.value = "";
			if (file === undefined) {
				return;
			}
			setFileName(file.name);
			setReport(null);
			setIdempotencyKey(newRowId());
			void file.text().then(
				(text: string): void => {
					const next = readKanbanCsv(text, columns, board);
					setRead(next);
					if (next.tasks.length > 0) {
						runPreview({ board, tasks: next.tasks.map(({ task }) => task) });
					}
				},
				(): void => {
					setRead({ tasks: [], problems: [{ line: 1, message: "The file could not be read." }] });
				},
			);
		},
		[board, columns, runPreview],
	);

	// Ready once the board has checked the rows that read cleanly (or there were none to check).
	const checked = read !== null && (read.tasks.length === 0 || report !== null);
	const plan = read === null ? null : planKanbanImport(read, report);

	const { mutate: runImport } = importTasks;
	const handleImport = React.useCallback((): void => {
		if (plan !== null && plan.importable.length > 0) {
			runImport({ input: { board, tasks: plan.importable.map(({ task }) => task) }, idempotencyKey });
		}
	}, [board, idempotencyKey, plan, runImport]);

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
					<DialogDescription>
						One item per row, after a header row. Only “title” is required; you report every item you import. Rows that can’t be imported are listed and skipped.
					</DialogDescription>
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
				{read !== null && !checked ? <p className="text-sm text-muted-foreground">Checking the rows against the board…</p> : null}
				{checked && plan !== null && plan.skipped.length > 0 ? (
					<div className="flex flex-col gap-1.5">
						<p className="text-sm font-medium">{plan.skipped.length === 1 ? "1 row will be skipped" : `${String(plan.skipped.length)} rows will be skipped`}</p>
						<ul role="alert" className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
							{plan.skipped.map((problem) => (
								<li key={`${String(problem.line)}:${problem.message}`}>
									Line {problem.line}: {problem.message}
								</li>
							))}
						</ul>
					</div>
				) : null}
				{checked && plan !== null ? (
					<p className="text-sm text-muted-foreground">
						{plan.importable.length === 0 ? "No rows can be imported. Fix the file and choose it again." : `${String(plan.importable.length)} items are ready to import.`}
					</p>
				) : null}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="button" disabled={!checked || plan === null || plan.importable.length === 0 || importTasks.isPending} onClick={handleImport}>
						{importTasks.isPending ? "Importing…" : plan === null || !checked ? "Import items" : importLabel(plan)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
