"use client";

import type { KanbanColumn as KanbanColumnData, KanbanTask } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import {
	Kanban,
	KanbanBoard,
	KanbanColumn,
	KanbanColumnContent,
	KanbanColumnHandle,
	KanbanItem,
	KanbanItemHandle,
	KanbanOverlay,
	type KanbanCommitMeta,
	type KanbanOverlayRenderParams,
} from "@workspace/ui/components/kanban";
import { ArrowLeft, ArrowRight, Gauge, GripVertical, MoreVertical, Plus } from "lucide-react";
import * as React from "react";

import { wipCountOf, type KanbanBoardValue, type KanbanWipCount } from "../lib/kanban-board-model";
import { itemCountLabel } from "../lib/kanban-display";
import type { KanbanStatusColumn } from "./kanban-task-badges";
import { KanbanTaskCard, type KanbanCardActions, type KanbanCardDestination } from "./kanban-task-card";

/** What a column header shows; its items come from the board value. */
export type KanbanColumnHeading = KanbanStatusColumn & {
	readonly id: string;
	/** The soft WIP limit (execution columns only), or `null` for none. */
	readonly wipLimit: number | null;
	/** The column's live stories and tasks, and its subtasks, whatever the filters show — what the WIP limit counts. */
	readonly wip: KanbanWipCount;
};

/** A board column as its header reads it: its stage or state, its limit (execution only) and what the limit counts. */
export function columnHeadingOf(column: KanbanColumnData): KanbanColumnHeading {
	return column.board === "PLANNING"
		? { id: column.id, board: column.board, title: column.title, stage: column.stage, wipLimit: null, wip: wipCountOf(column.tasks) }
		: { id: column.id, board: column.board, title: column.title, state: column.state, wipLimit: column.wipLimit, wip: wipCountOf(column.tasks) };
}

/** `"+3 subtasks"`: what a column holds beyond what its WIP limit counts. */
function subtasksBeside(count: number): string {
	return `+${String(count)} ${count === 1 ? "subtask" : "subtasks"}`;
}

/**
 * A column's WIP against its limit — `5/6 · +3 subtasks` — amber at the limit,
 * red over it. Stories and tasks count; a subtask is part of its task's work,
 * so it is named beside the count, never in it.
 */
export function KanbanWipBadge({ column }: { readonly column: KanbanColumnHeading }): React.JSX.Element | null {
	if (column.wipLimit === null) {
		return null;
	}
	const { counted, subtasks } = column.wip;
	const variant = counted > column.wipLimit ? "destructive-light" : counted === column.wipLimit ? "warning-light" : "outline";
	return (
		<Badge
			variant={variant}
			className="rounded-md px-1.5 font-medium whitespace-nowrap tabular-nums"
			title="Stories and tasks in the column against its work-in-progress limit (subtasks never count)">
			{counted}/{column.wipLimit}
			{subtasks > 0 ? <span className="font-normal opacity-80"> · {subtasksBeside(subtasks)}</span> : null}
		</Badge>
	);
}

/** Which way a column moves from its menu (keyboard and pointer alternative to dragging it). */
export type KanbanColumnStep = "left" | "right";

export interface KanbanBoardColumnsProps {
	/** Left to right. */
	readonly columns: readonly KanbanColumnHeading[];
	/** Column id → the tasks to show, as arranged (filtered and sorted). */
	readonly value: KanbanBoardValue;
	/** Cards drag only in the board's own order (a sorted view is read-only). */
	readonly canDragTasks: boolean;
	readonly canDragColumns: boolean;
	readonly canCreateTasks: boolean;
	/** Offers "Set WIP limit" in each column's menu. */
	readonly canManageColumns: boolean;
	/** `false` inside a swimlane: the lanes share one header row above them. */
	readonly showHeaders?: boolean;
	readonly taskHref: (taskId: string) => string;
	/** Every live change while dragging (the preview). */
	readonly onValueChange: (value: KanbanBoardValue) => void;
	/** Once per finished drag that moved something (after `onDragFinish`). */
	readonly onCommit: (value: KanbanBoardValue, meta: KanbanCommitMeta<KanbanTask>) => void;
	/** Every drag's end, moved or not, dropped or cancelled. */
	readonly onDragFinish: () => void;
	readonly onAddTask: (columnId: string) => void;
	readonly onMoveColumn: (columnId: string, step: KanbanColumnStep) => void;
	readonly onSetWipLimit: (columnId: string) => void;
	/** What each card's ⋯ menu offers (its columns come from `columns`). */
	readonly cardActions?: KanbanCardActions | undefined;
}

function taskId(task: KanbanTask): string {
	return task.id;
}

const COLUMN_HANDLE = <Button variant="ghost" size="icon-xs" className="-ml-2 text-foreground/70" />;

interface KanbanBoardColumnSectionProps {
	readonly column: KanbanColumnHeading;
	readonly tasks: readonly KanbanTask[];
	readonly isFirst: boolean;
	readonly isLast: boolean;
	readonly canDragTasks: boolean;
	readonly canDragColumns: boolean;
	readonly canCreateTasks: boolean;
	readonly canManageColumns: boolean;
	readonly showHeader: boolean;
	readonly taskHref: (taskId: string) => string;
	readonly onAddTask: (columnId: string) => void;
	readonly onMoveColumn: (columnId: string, step: KanbanColumnStep) => void;
	readonly onSetWipLimit: (columnId: string) => void;
	readonly cardActions: KanbanCardActions;
}

/** One column: its header (grip, title, count, WIP, add, actions) over its cards. */
function KanbanBoardColumnSection({
	column,
	tasks,
	isFirst,
	isLast,
	canDragTasks,
	canDragColumns,
	canCreateTasks,
	canManageColumns,
	showHeader,
	taskHref,
	onAddTask,
	onMoveColumn,
	onSetWipLimit,
	cardActions,
}: KanbanBoardColumnSectionProps): React.JSX.Element {
	const handleAddTask = React.useCallback((): void => {
		onAddTask(column.id);
	}, [column.id, onAddTask]);
	const handleMoveLeft = React.useCallback((): void => {
		onMoveColumn(column.id, "left");
	}, [column.id, onMoveColumn]);
	const handleMoveRight = React.useCallback((): void => {
		onMoveColumn(column.id, "right");
	}, [column.id, onMoveColumn]);
	const handleSetWipLimit = React.useCallback((): void => {
		onSetWipLimit(column.id);
	}, [column.id, onSetWipLimit]);

	return (
		<KanbanColumn value={column.id} locked={!canDragColumns} render={<section aria-label={column.title} />} className="flex min-h-0 flex-col rounded-lg bg-muted/60">
			{showHeader ? (
				<div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2">
					<div className="flex min-w-0 items-center gap-1.5">
						{canDragColumns ? (
							<KanbanColumnHandle render={COLUMN_HANDLE} className="opacity-100" aria-label={`Drag ${column.title} column`}>
								<GripVertical />
							</KanbanColumnHandle>
						) : null}
						<h2 className="truncate text-sm font-semibold text-foreground/80">{column.title}</h2>
						<span className="rounded-full bg-foreground/8 px-1.5 text-xs font-medium text-muted-foreground tabular-nums" title={itemCountLabel(tasks.length)}>
							<span className="sr-only">{itemCountLabel(tasks.length)}</span>
							<span aria-hidden>{tasks.length}</span>
						</span>
						<KanbanWipBadge column={column} />
						{column.wipLimit === null && column.wip.subtasks > 0 ? (
							<span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{subtasksBeside(column.wip.subtasks)}</span>
						) : null}
					</div>
					<div className="-mr-1 flex items-center gap-0.5 text-muted-foreground">
						{canCreateTasks ? (
							<Button variant="ghost" size="icon-sm" aria-label={`Add task to ${column.title}`} onClick={handleAddTask}>
								<Plus />
							</Button>
						) : null}
						<DropdownMenu>
							<DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`${column.title} column actions`} />}>
								<MoreVertical />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem disabled={!canCreateTasks} onClick={handleAddTask}>
									<Plus />
									Add task
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem disabled={!canDragColumns || isFirst} onClick={handleMoveLeft}>
									<ArrowLeft />
									Move left
								</DropdownMenuItem>
								<DropdownMenuItem disabled={!canDragColumns || isLast} onClick={handleMoveRight}>
									<ArrowRight />
									Move right
								</DropdownMenuItem>
								{column.board === "EXECUTION" ? (
									<>
										<DropdownMenuSeparator />
										<DropdownMenuItem disabled={!canManageColumns} onClick={handleSetWipLimit}>
											<Gauge />
											Set WIP limit
										</DropdownMenuItem>
									</>
								) : null}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
			) : null}

			<KanbanColumnContent
				value={column.id}
				className={
					showHeader
						? "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
						: "flex min-h-16 flex-1 flex-col gap-2 p-2"
				}>
				{tasks.map((task) => (
					<KanbanItem key={task.id} value={task.id} locked={!canDragTasks} className="touch-none">
						<KanbanItemHandle cursor={canDragTasks}>
							<KanbanTaskCard task={task} column={column} href={taskHref(task.id)} actions={cardActions} />
						</KanbanItemHandle>
					</KanbanItem>
				))}
			</KanbanColumnContent>
		</KanbanColumn>
	);
}

/**
 * The board view: columns side by side (scrolling sideways), each a header
 * with its count and actions over its cards (scrolling down). Cards move by
 * drag and drop within and across columns, and columns reorder by their grip,
 * with pointer, touch or keyboard — through the kit's `Kanban` primitive.
 */
export function KanbanBoardColumns({
	columns,
	value,
	canDragTasks,
	canDragColumns,
	canCreateTasks,
	canManageColumns,
	showHeaders = true,
	taskHref,
	onValueChange,
	onCommit,
	onDragFinish,
	onAddTask,
	onMoveColumn,
	onSetWipLimit,
	cardActions,
}: KanbanBoardColumnsProps): React.JSX.Element {
	const destinations = React.useMemo((): readonly KanbanCardDestination[] => columns.map((column) => ({ id: column.id, title: column.title })), [columns]);
	const actions = React.useMemo((): KanbanCardActions => ({ ...cardActions, destinations }), [cardActions, destinations]);
	const headingOf = React.useCallback((columnId: string): KanbanColumnHeading | undefined => columns.find((column) => column.id === columnId), [columns]);
	const ordered = React.useMemo((): KanbanColumnHeading[] => Object.keys(value).flatMap((columnId) => headingOf(columnId) ?? []), [headingOf, value]);

	const renderOverlay = React.useCallback(
		({ value: activeId, variant }: KanbanOverlayRenderParams): React.ReactNode => {
			if (variant === "column") {
				const column = headingOf(String(activeId));
				return column === undefined ? null : (
					<div className="flex w-72 items-center gap-1.5 rounded-lg bg-muted px-3 py-2.5 shadow-lg">
						<h2 className="truncate text-sm font-semibold text-foreground/80">{column.title}</h2>
						<span className="text-xs text-muted-foreground tabular-nums">{itemCountLabel(value[column.id]?.length ?? 0)}</span>
					</div>
				);
			}
			for (const [columnId, tasks] of Object.entries(value)) {
				const task = tasks.find((candidate) => candidate.id === activeId);
				const column = headingOf(columnId);
				if (task !== undefined && column !== undefined) {
					return <KanbanTaskCard task={task} column={column} href={taskHref(task.id)} isOverlay />;
				}
			}
			return null;
		},
		[headingOf, taskHref, value],
	);

	return (
		// The root is a plain block: it takes the board's height so the grid (and each column's scroll area) can too.
		<Kanban
			className="h-full"
			value={value}
			onValueChange={onValueChange}
			getItemValue={taskId}
			onValueCommit={onCommit}
			onDragEnd={onDragFinish}
			onDragCancel={onDragFinish}
			restoreOnCancel>
			{/* One row as tall as the board (`minmax(0, 1fr)`), so a long column scrolls inside itself instead of growing past the board. */}
			<KanbanBoard className="grid h-full min-w-full auto-cols-[minmax(17rem,1fr)] grid-flow-col grid-cols-none grid-rows-[minmax(0,1fr)] gap-3 sm:grid-cols-none">
				{ordered.map((column, index) => (
					<KanbanBoardColumnSection
						key={column.id}
						column={column}
						tasks={value[column.id] ?? []}
						isFirst={index === 0}
						isLast={index === ordered.length - 1}
						canDragTasks={canDragTasks}
						canDragColumns={showHeaders ? canDragColumns : false}
						canCreateTasks={canCreateTasks}
						canManageColumns={canManageColumns}
						showHeader={showHeaders}
						taskHref={taskHref}
						onAddTask={onAddTask}
						onMoveColumn={onMoveColumn}
						onSetWipLimit={onSetWipLimit}
						cardActions={actions}
					/>
				))}
			</KanbanBoard>
			<KanbanOverlay>{renderOverlay}</KanbanOverlay>
		</Kanban>
	);
}
