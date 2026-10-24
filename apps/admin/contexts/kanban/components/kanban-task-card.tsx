import { KANBAN_PARENT_TYPE, kanbanColumnIsDone, type KanbanTask } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Progress } from "@workspace/ui/components/progress";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowRightLeft, Ban, CalendarDays, CircleCheck, Columns3, ExternalLink, ListChecks, ListTree, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { columnIsInProgress, effectiveSchedule, formatDueDate, KANBAN_TYPE_DISPLAY, KANBAN_TYPE_ICON_CLASS, percentOf, visibleInsights } from "../lib/kanban-display";
import { KanbanCardChildren } from "./kanban-card-children";
import { KanbanAssignee } from "./kanban-person";
import { KanbanLabelChips, KanbanLevelChip, KanbanPointsPill, KanbanPriorityIcon, type KanbanStatusColumn } from "./kanban-task-badges";

/** Labels a card shows before folding the rest into "+n". */
const CARD_LABEL_LIMIT = 2;

/** A column a card can be sent to from its menu: the keyboard and pointer alternative to dragging it. */
export interface KanbanCardDestination {
	readonly id: string;
	readonly title: string;
}

/** What a card's menu can do, when the board offers it. */
export interface KanbanCardActions {
	/** Move to…: another parent one level up. */
	readonly onMoveTo?: ((task: KanbanTask) => void) | undefined;
	/** Move to column: another column of the board, at the top. */
	readonly destinations?: readonly KanbanCardDestination[] | undefined;
	readonly onMoveToColumn?: ((task: KanbanTask, columnId: string) => void) | undefined;
	/** A task's "3 subtasks · 1 done" badge shows or hides the board's subtask cards. */
	readonly onToggleSubtasks?: (() => void) | undefined;
	readonly subtasksShown?: boolean | undefined;
}

/** The item one level up as a soft chip in its level's tone, the way a tracker tags a card with its feature. */
function ParentChip({ task }: { readonly task: KanbanTask }): React.JSX.Element | null {
	const parent = task.ancestors.at(task.ancestors.length - 1);
	if (parent === undefined) {
		return null;
	}
	return (
		<span className={cn("inline-flex max-w-full min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium", KANBAN_TYPE_ICON_CLASS[parent.type])}>
			<span className="sr-only">{KANBAN_TYPE_DISPLAY[parent.type].label}:</span>
			{parent.key === null ? null : <span className="shrink-0 font-mono text-[0.6875rem] opacity-80">{parent.key}</span>}
			<span className="truncate">{parent.title}</span>
		</span>
	);
}

/** An epic's or a feature's rolled-up story points, as a thin bar of what is done. */
function Rollup({ task }: { readonly task: KanbanTask }): React.JSX.Element | null {
	const { points } = task.rollup;
	if (points.total === 0) {
		return null;
	}
	const percent = percentOf(points.done, points.total);
	return (
		<div className="flex items-center gap-2">
			<Progress value={percent} className="h-1 flex-1" aria-label={`${task.title} story points done`} />
			<span className="text-xs text-muted-foreground tabular-nums">
				{points.done}/{points.total} pts
			</span>
		</div>
	);
}

/** A task's subtasks, `3 subtasks · 1 done`: pressing it shows or hides every subtask card on the board. */
function SubtasksBadge({ task, actions }: { readonly task: KanbanTask; readonly actions: KanbanCardActions }): React.JSX.Element | null {
	const { done, total } = task.rollup.children;
	if (total === 0) {
		return null;
	}
	const text = `${String(total)} ${total === 1 ? "subtask" : "subtasks"} · ${String(done)} done`;
	if (actions.onToggleSubtasks === undefined) {
		return (
			<span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
				<ListTree aria-hidden className="size-3.5" />
				{text}
			</span>
		);
	}
	return (
		<button
			type="button"
			aria-pressed={actions.subtasksShown === true}
			title={actions.subtasksShown === true ? "Hide subtask cards" : "Show subtask cards"}
			onClick={actions.onToggleSubtasks}
			className="-mx-1 flex w-fit items-center gap-1 rounded px-1 py-0.5 text-xs text-muted-foreground tabular-nums transition-colors outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
			<ListTree aria-hidden className="size-3.5" />
			{text}
		</button>
	);
}

/** The card's ⋯ menu: open it, Move to…, or send it to another column without dragging. */
function CardMenu({ task, href, actions }: { readonly task: KanbanTask; readonly href: string; readonly actions: KanbanCardActions }): React.JSX.Element {
	const canMoveTo = actions.onMoveTo !== undefined && KANBAN_PARENT_TYPE[task.type] !== null;
	const destinations = actions.destinations?.filter((column) => column.id !== task.columnId) ?? [];
	const handleMoveTo = React.useCallback((): void => {
		actions.onMoveTo?.(task);
	}, [actions, task]);
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="ghost" size="icon-xs" className="-mr-1 shrink-0 text-muted-foreground" aria-label={`Actions for ${task.key ?? task.title}`} />}>
				<MoreHorizontal />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuItem render={<Link href={href} />}>
					<ExternalLink />
					Open
				</DropdownMenuItem>
				{canMoveTo || destinations.length > 0 ? <DropdownMenuSeparator /> : null}
				{canMoveTo ? (
					<DropdownMenuItem onClick={handleMoveTo}>
						<ArrowRightLeft />
						Move to…
					</DropdownMenuItem>
				) : null}
				{destinations.length > 0 && actions.onMoveToColumn !== undefined ? (
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<Columns3 />
							Move to column
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent>
							{destinations.map((column) => (
								<CardDestinationItem key={column.id} task={task} column={column} onMoveToColumn={actions.onMoveToColumn} />
							))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function CardDestinationItem({
	task,
	column,
	onMoveToColumn,
}: {
	readonly task: KanbanTask;
	readonly column: KanbanCardDestination;
	readonly onMoveToColumn: ((task: KanbanTask, columnId: string) => void) | undefined;
}): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onMoveToColumn?.(task, column.id);
	}, [column.id, onMoveToColumn, task]);
	return <DropdownMenuItem onClick={handleClick}>{column.title}</DropdownMenuItem>;
}

export interface KanbanTaskCardProps {
	readonly task: KanbanTask;
	/** The column the card sits in: an in-progress card shows its progress, a done card says so. */
	readonly column: KanbanStatusColumn;
	/** The item's page; the title links there. */
	readonly href: string;
	/** Drawn as the drag preview: fixed width, tilted, lifted. */
	readonly isOverlay?: boolean;
	readonly actions?: KanbanCardActions | undefined;
}

const NO_ACTIONS: KanbanCardActions = {};

/**
 * One item as the board shows it, compact like a tracker's card. Its top row
 * says what it is — the level's icon, its name and its key (`STORY STORY-142`)
 * — with the card's ⋯ menu; then the title, the parent it sits under and its
 * labels; an epic's or feature's points bar, or — while in progress — the
 * item's own progress; a task's subtasks badge; then one row of icons
 * (priority, blocked, checklist and counts) with the due date, estimate and
 * assignee on the right; and an expander that opens what sits below it.
 * Data-agnostic: the caller passes the item.
 */
export const KanbanTaskCard = React.forwardRef<HTMLElement, KanbanTaskCardProps>(function KanbanTaskCard(
	{ task, column, href, isOverlay = false, actions = NO_ACTIONS },
	ref,
): React.JSX.Element {
	const isDone = kanbanColumnIsDone(column);
	const isPlanningItem = task.type === "EPIC" || task.type === "FEATURE";
	const checklist = task.type === "SUBTASK" ? task.steps : task.acceptanceCriteria;
	const dueAt = effectiveSchedule(task).dueAt;
	const points = task.type === "STORY" ? task.storyPoints : isPlanningItem && task.rollup.points.total > 0 ? task.rollup.points.total : null;

	return (
		<article
			ref={ref}
			aria-label={`${KANBAN_TYPE_DISPLAY[task.type].label} ${task.key ?? ""} ${task.title}`}
			className={cn(
				"flex flex-col gap-2 rounded-md border bg-card p-3 text-card-foreground transition-colors hover:border-foreground/20",
				task.type === "SUBTASK" && "border-dashed",
				isOverlay && "w-72 rotate-1 shadow-lg",
			)}>
			<div className="flex min-w-0 items-center justify-between gap-2">
				<KanbanLevelChip type={task.type} itemKey={task.key} />
				{isOverlay ? null : <CardMenu task={task} href={href} actions={actions} />}
			</div>

			<h3 className="text-sm leading-snug">
				<Link
					href={href}
					className={cn("line-clamp-3 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring", isDone && "text-muted-foreground")}
					draggable={false}>
					{task.title}
				</Link>
			</h3>

			{task.ancestors.length > 0 || task.labels.length > 0 ? (
				<div className="flex min-w-0 flex-wrap items-center gap-1">
					<ParentChip task={task} />
					<KanbanLabelChips labels={task.labels} max={CARD_LABEL_LIMIT} />
				</div>
			) : null}

			{isPlanningItem ? <Rollup task={task} /> : null}
			{!isPlanningItem && columnIsInProgress(column) ? (
				<div className="flex items-center gap-2">
					<Progress value={task.progress} className="h-1 flex-1" aria-label={`${task.title} progress`} />
					<span className="text-xs text-muted-foreground tabular-nums">{task.progress}%</span>
				</div>
			) : null}
			{task.type === "TASK" ? <SubtasksBadge task={task} actions={actions} /> : null}

			<div className="flex items-end justify-between gap-2 text-muted-foreground">
				{/* Wraps onto a second line in a narrow column instead of pushing the assignee off the card. */}
				<span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
					<KanbanPriorityIcon priority={task.priority} />
					{isDone ? (
						<span className="flex items-center gap-1 text-xs font-medium text-tone-green">
							<CircleCheck aria-hidden className="size-3.5" />
							{column.board === "PLANNING" ? "Delivered" : "Done"}
						</span>
					) : null}
					{task.isBlocked && !isDone ? (
						<span role="img" aria-label="Blocked" title="Blocked by an item that is not done" className="inline-flex text-tone-red">
							<Ban aria-hidden className="size-3.5" />
						</span>
					) : null}
					{!isDone && checklist.total > 0 ? (
						<span className="flex items-center gap-1 text-xs tabular-nums" title={task.type === "SUBTASK" ? "Steps done" : "Acceptance criteria met"}>
							<ListChecks aria-hidden className="size-3.5" />
							<span className="sr-only">{task.type === "SUBTASK" ? "Steps done:" : "Acceptance criteria met:"}</span>
							{checklist.done}/{checklist.total}
						</span>
					) : null}
					{isDone
						? null
						: visibleInsights(task.counts).map((insight) => {
								const Icon = insight.icon;
								return (
									<span key={insight.key} className="flex items-center gap-1 text-xs tabular-nums" title={insight.label}>
										<Icon aria-hidden className="size-3.5" />
										<span className="sr-only">{insight.label}:</span>
										{task.counts[insight.key]}
									</span>
								);
							})}
					{dueAt === null || isDone ? null : (
						<span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums" title="Due">
							<CalendarDays aria-hidden className="size-3" />
							<span className="sr-only">Due</span>
							{formatDueDate(dueAt)}
						</span>
					)}
				</span>
				<span className="flex shrink-0 items-center gap-1.5">
					{points === null ? null : <KanbanPointsPill points={points} />}
					<KanbanAssignee person={task.assignee} compact />
				</span>
			</div>

			{isOverlay || task.type === "TASK" ? null : <KanbanCardChildren task={task} />}
		</article>
	);
});
