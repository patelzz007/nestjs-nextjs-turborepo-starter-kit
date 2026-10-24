"use client";

import { KANBAN_ACCEPTANCE_CRITERIA_LIMIT, KANBAN_CHECKLIST_TITLE_MAX_LENGTH, KANBAN_STEP_LIMIT, KANBAN_STEP_MAX_DEPTH, type KanbanPerson } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowDown, ArrowUp, CornerDownRight, IndentDecrease, IndentIncrease, ListPlus, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { KANBAN_STEP_DEPTH_LABEL } from "../lib/kanban-display";
import { moveRow, newCriterionRow, newStepRow, normalizeStepDepths, type KanbanCriterionRowValues, type KanbanStepRowValues } from "../lib/kanban-task-form";
import { KanbanAssigneeSelect } from "./kanban-pickers";

/** How far each step level is indented. */
const INDENT_CLASS: readonly string[] = ["", "pl-6"];

function depthLabel(depth: number): string {
	return KANBAN_STEP_DEPTH_LABEL.at(depth) ?? "Step";
}

interface StepRowEditorProps {
	readonly row: KanbanStepRowValues;
	readonly index: number;
	readonly count: number;
	/** The depth of the row above (`-1` for the first row): a row is at most one level below it. */
	readonly previousDepth: number;
	readonly people: readonly KanbanPerson[];
	readonly onChange: (index: number, row: KanbanStepRowValues) => void;
	readonly onMove: (index: number, step: -1 | 1) => void;
	readonly onRemove: (index: number) => void;
	readonly onAddBelow: (index: number) => void;
}

function StepRowEditor({ row, index, count, previousDepth, people, onChange, onMove, onRemove, onAddBelow }: StepRowEditorProps): React.JSX.Element {
	const label = depthLabel(row.depth);
	const handleTitle = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(index, { ...row, title: event.target.value });
		},
		[index, onChange, row],
	);
	const handleDone = React.useCallback(
		(checked: boolean): void => {
			onChange(index, { ...row, isDone: checked });
		},
		[index, onChange, row],
	);
	const handleAssignee = React.useCallback(
		(assigneeId: string): void => {
			onChange(index, { ...row, assigneeId });
		},
		[index, onChange, row],
	);
	const handleIndent = React.useCallback((): void => {
		onChange(index, { ...row, depth: row.depth + 1 });
	}, [index, onChange, row]);
	const handleOutdent = React.useCallback((): void => {
		onChange(index, { ...row, depth: row.depth - 1 });
	}, [index, onChange, row]);
	const handleUp = React.useCallback((): void => {
		onMove(index, -1);
	}, [index, onMove]);
	const handleDown = React.useCallback((): void => {
		onMove(index, 1);
	}, [index, onMove]);
	const handleRemove = React.useCallback((): void => {
		onRemove(index);
	}, [index, onRemove]);
	const handleAddBelow = React.useCallback((): void => {
		onAddBelow(index);
	}, [index, onAddBelow]);
	const name = row.title.length > 0 ? row.title : `${label} ${String(index + 1)}`;

	return (
		<li className={cn("flex flex-col gap-2 py-2 sm:flex-row sm:items-center", INDENT_CLASS.at(row.depth))}>
			<div className="flex min-w-0 flex-1 items-center gap-2">
				{row.depth > 0 ? <CornerDownRight aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
				<Checkbox checked={row.isDone} onCheckedChange={handleDone} aria-label={`${name} done`} />
				<Input
					value={row.title}
					onChange={handleTitle}
					maxLength={KANBAN_CHECKLIST_TITLE_MAX_LENGTH}
					placeholder={label}
					aria-label={`${label} ${String(index + 1)} title`}
					className={cn("min-w-0 flex-1", row.isDone && "text-muted-foreground line-through")}
				/>
			</div>
			<div className="flex items-center gap-1">
				<div className="w-40">
					<KanbanAssigneeSelect id={`kanban-step-${row.key}-assignee`} value={row.assigneeId} onChange={handleAssignee} people={people} ariaLabel={`${name} assignee`} />
				</div>
				<Button type="button" variant="ghost" size="icon-sm" aria-label={`Outdent ${name}`} disabled={row.depth === 0} onClick={handleOutdent}>
					<IndentDecrease />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={`Indent ${name}`}
					disabled={row.depth >= KANBAN_STEP_MAX_DEPTH || row.depth > previousDepth}
					onClick={handleIndent}>
					<IndentIncrease />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={`Add a step under ${name}`}
					disabled={row.depth >= KANBAN_STEP_MAX_DEPTH || count >= KANBAN_STEP_LIMIT}
					onClick={handleAddBelow}>
					<ListPlus />
				</Button>
				<Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${name} up`} disabled={index === 0} onClick={handleUp}>
					<ArrowUp />
				</Button>
				<Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${name} down`} disabled={index === count - 1} onClick={handleDown}>
					<ArrowDown />
				</Button>
				<Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} onClick={handleRemove}>
					<Trash2 />
				</Button>
			</div>
		</li>
	);
}

export interface KanbanStepEditorProps {
	readonly rows: readonly KanbanStepRowValues[];
	readonly onChange: (rows: KanbanStepRowValues[]) => void;
	readonly people: readonly KanbanPerson[];
}

/**
 * A subtask's steps, edited as an outline: sub-subtasks and their
 * sub-sub-subtasks, each ticked off, assigned, indented, reordered or removed.
 * The tree stays valid as it is edited (`normalizeStepDepths`).
 */
export function KanbanStepEditor({ rows, onChange, people }: KanbanStepEditorProps): React.JSX.Element {
	const commit = React.useCallback(
		(next: readonly KanbanStepRowValues[]): void => {
			onChange(normalizeStepDepths(next));
		},
		[onChange],
	);
	const handleRowChange = React.useCallback(
		(index: number, row: KanbanStepRowValues): void => {
			commit(rows.map((candidate, position) => (position === index ? row : candidate)));
		},
		[commit, rows],
	);
	const handleMove = React.useCallback(
		(index: number, step: -1 | 1): void => {
			commit(moveRow(rows, index, step));
		},
		[commit, rows],
	);
	const handleRemove = React.useCallback(
		(index: number): void => {
			commit(rows.filter((_, position) => position !== index));
		},
		[commit, rows],
	);
	const handleAddBelow = React.useCallback(
		(index: number): void => {
			const parent = rows.at(index);
			const next = [...rows];
			next.splice(index + 1, 0, newStepRow((parent?.depth ?? 0) + 1));
			commit(next);
		},
		[commit, rows],
	);
	const handleAdd = React.useCallback((): void => {
		commit([...rows, newStepRow(0)]);
	}, [commit, rows]);

	return (
		<div className="flex flex-col gap-2">
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">No steps yet. Break the subtask down into the steps it takes.</p>
			) : (
				<ul className="divide-y">
					{rows.map((row, index) => (
						<StepRowEditor
							key={row.key}
							row={row}
							index={index}
							count={rows.length}
							previousDepth={rows.at(index - 1)?.depth ?? -1}
							people={people}
							onChange={handleRowChange}
							onMove={handleMove}
							onRemove={handleRemove}
							onAddBelow={handleAddBelow}
						/>
					))}
				</ul>
			)}
			<div>
				<Button type="button" variant="outline" size="sm" disabled={rows.length >= KANBAN_STEP_LIMIT} onClick={handleAdd}>
					<Plus data-icon="inline-start" />
					Add step
				</Button>
			</div>
		</div>
	);
}

interface CriterionRowEditorProps {
	readonly row: KanbanCriterionRowValues;
	readonly index: number;
	readonly count: number;
	readonly onChange: (index: number, row: KanbanCriterionRowValues) => void;
	readonly onMove: (index: number, step: -1 | 1) => void;
	readonly onRemove: (index: number) => void;
}

function CriterionRowEditor({ row, index, count, onChange, onMove, onRemove }: CriterionRowEditorProps): React.JSX.Element {
	const handleTitle = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(index, { ...row, title: event.target.value });
		},
		[index, onChange, row],
	);
	const handleDone = React.useCallback(
		(checked: boolean): void => {
			onChange(index, { ...row, isDone: checked });
		},
		[index, onChange, row],
	);
	const handleUp = React.useCallback((): void => {
		onMove(index, -1);
	}, [index, onMove]);
	const handleDown = React.useCallback((): void => {
		onMove(index, 1);
	}, [index, onMove]);
	const handleRemove = React.useCallback((): void => {
		onRemove(index);
	}, [index, onRemove]);
	const name = row.title.length > 0 ? row.title : `Criterion ${String(index + 1)}`;

	return (
		<li className="flex items-center gap-2 py-2">
			<Checkbox checked={row.isDone} onCheckedChange={handleDone} aria-label={`${name} met`} />
			<Input
				value={row.title}
				onChange={handleTitle}
				maxLength={KANBAN_CHECKLIST_TITLE_MAX_LENGTH}
				placeholder="Given … when … then …"
				aria-label={`Criterion ${String(index + 1)}`}
				className={cn("min-w-0 flex-1", row.isDone && "text-muted-foreground line-through")}
			/>
			<Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${name} up`} disabled={index === 0} onClick={handleUp}>
				<ArrowUp />
			</Button>
			<Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${name} down`} disabled={index === count - 1} onClick={handleDown}>
				<ArrowDown />
			</Button>
			<Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${name}`} onClick={handleRemove}>
				<Trash2 />
			</Button>
		</li>
	);
}

export interface KanbanCriteriaEditorProps {
	readonly rows: readonly KanbanCriterionRowValues[];
	readonly onChange: (rows: KanbanCriterionRowValues[]) => void;
}

/** A feature's or story's acceptance criteria: what must be true for it to be done. */
export function KanbanCriteriaEditor({ rows, onChange }: KanbanCriteriaEditorProps): React.JSX.Element {
	const handleRowChange = React.useCallback(
		(index: number, row: KanbanCriterionRowValues): void => {
			onChange(rows.map((candidate, position) => (position === index ? row : candidate)));
		},
		[onChange, rows],
	);
	const handleMove = React.useCallback(
		(index: number, step: -1 | 1): void => {
			onChange(moveRow(rows, index, step));
		},
		[onChange, rows],
	);
	const handleRemove = React.useCallback(
		(index: number): void => {
			onChange(rows.filter((_, position) => position !== index));
		},
		[onChange, rows],
	);
	const handleAdd = React.useCallback((): void => {
		onChange([...rows, newCriterionRow()]);
	}, [onChange, rows]);

	return (
		<div className="flex flex-col gap-2">
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">No acceptance criteria yet. Say what must be true for this to be done.</p>
			) : (
				<ul className="divide-y">
					{rows.map((row, index) => (
						<CriterionRowEditor key={row.key} row={row} index={index} count={rows.length} onChange={handleRowChange} onMove={handleMove} onRemove={handleRemove} />
					))}
				</ul>
			)}
			<div>
				<Button type="button" variant="outline" size="sm" disabled={rows.length >= KANBAN_ACCEPTANCE_CRITERIA_LIMIT} onClick={handleAdd}>
					<Plus data-icon="inline-start" />
					Add criterion
				</Button>
			</div>
		</div>
	);
}
