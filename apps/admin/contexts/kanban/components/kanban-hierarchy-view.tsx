"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { kanbanColumnIsDone, type KanbanColumn, type KanbanTask } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import { Ban, SquareCheck, ChevronRight, ChevronsDownUp, ChevronsUpDown, Square } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

import { hasActiveFilters, type KanbanTaskFilters } from "../lib/kanban-board-model";
import { childCountOf, effectiveSchedule, formatDueDate, itemCountLabel, pointsLabel } from "../lib/kanban-display";
import { buildHierarchy, countNodes, expandableIds, filterHierarchy, isExpandable, treeProgress, type KanbanTreeNode } from "../lib/kanban-hierarchy";
import { KanbanAssignee } from "./kanban-person";
import { KanbanLevelChip, KanbanPriorityIcon, KanbanStatusBadge } from "./kanban-task-badges";

/** How far each depth of the tree is indented: five item levels, then the two step levels. */
const INDENT_CLASS: readonly string[] = ["pl-0", "pl-6", "pl-12", "pl-18", "pl-24", "pl-30", "pl-36"];
/** Skeleton rows drawn while both boards load. */
const SKELETON_ROW_COUNT = 8;

/** Which rows are open: a set of item ids, or every row that can open. */
type KanbanTreeExpansion = ReadonlySet<string> | "all";

function isOpen(expansion: KanbanTreeExpansion, id: string): boolean {
	return expansion === "all" || expansion.has(id);
}

/** The toggle at the start of a row, or a spacer the same width so titles line up. */
function RowToggle({ label, isExpanded, onToggle }: { readonly label: string; readonly isExpanded: boolean | null; readonly onToggle: () => void }): React.JSX.Element {
	if (isExpanded === null) {
		return <span aria-hidden className="size-6 shrink-0" />;
	}
	return (
		<Button
			variant="ghost"
			size="icon-xs"
			className="size-6 shrink-0 text-muted-foreground"
			aria-label={`${isExpanded ? "Collapse" : "Expand"} ${label}`}
			aria-expanded={isExpanded}
			onClick={onToggle}>
			<ChevronRight className={cn("transition-transform duration-200", isExpanded && "rotate-90")} />
		</Button>
	);
}

/** A subtask's steps as rows under it, loaded the first time the subtask is opened. */
function StepRows({ task, depth }: { readonly task: KanbanTask; readonly depth: number }): React.JSX.Element {
	const { api } = useAuth();
	const query = api.kanban.task.useQuery({ taskId: task.id });
	const detail = query.data?.data;
	if (detail === undefined) {
		return (
			<tr className="border-b">
				<td colSpan={7} className={cn("py-2 pr-3", INDENT_CLASS.at(depth))}>
					{query.isError ? <span className="pl-8 text-xs text-destructive">Could not load the steps.</span> : <Skeleton className="ml-8 h-5 w-64" />}
				</td>
			</tr>
		);
	}
	return (
		<>
			{detail.stepItems.map((row) => (
				<tr key={row.id} className="border-b text-muted-foreground transition-colors hover:bg-muted/40">
					<td className="py-1.5 pr-3">
						<div className={cn("flex min-w-0 items-center gap-2", INDENT_CLASS.at(depth + row.depth))}>
							<span aria-hidden className="size-6 shrink-0" />
							{row.isDone ? <SquareCheck aria-hidden className="size-4 shrink-0 text-tone-green" /> : <Square aria-hidden className="size-4 shrink-0" />}
							<span className={cn("truncate text-sm text-foreground", row.isDone && "text-muted-foreground line-through")}>{row.title}</span>
						</div>
					</td>
					<td className="px-3 py-1.5 text-xs">{row.isDone ? "Done" : "Open"}</td>
					<td className="px-3 py-1.5">{row.assignee === null ? null : <KanbanAssignee person={row.assignee} />}</td>
					<td className="px-3 py-1.5" />
					<td className="px-3 py-1.5" />
					<td className="px-3 py-1.5" />
					<td className="px-3 py-1.5" />
				</tr>
			))}
		</>
	);
}

interface TreeRowsProps {
	readonly node: KanbanTreeNode;
	readonly depth: number;
	readonly expansion: KanbanTreeExpansion;
	readonly onToggle: (id: string) => void;
}

/** One item's row and — while it is open — the rows below it. */
function TreeRows({ node, depth, expansion, onToggle }: TreeRowsProps): React.JSX.Element {
	const { task, status } = node;
	const canExpand = isExpandable(node);
	const expanded = canExpand && isOpen(expansion, task.id);
	const handleToggle = React.useCallback((): void => {
		onToggle(task.id);
	}, [onToggle, task.id]);
	const progress = treeProgress(task);
	const dueAt = effectiveSchedule(task).dueAt;
	const points =
		task.type === "STORY" ? task.storyPoints : task.type === "TASK" || task.type === "SUBTASK" || task.rollup.points.total === 0 ? null : task.rollup.points.total;
	const below = childCountOf(task);
	return (
		<>
			<tr className="border-b transition-colors hover:bg-muted/40">
				<td className="py-1.5 pr-3">
					<div className={cn("flex min-w-0 items-center gap-2", INDENT_CLASS.at(depth))}>
						<RowToggle label={task.title} isExpanded={canExpand ? expanded : null} onToggle={handleToggle} />
						<KanbanLevelChip type={task.type} itemKey={task.key} />
						<Link href={ROUTES.kanban.task(task.id)} className={cn("min-w-0 truncate hover:underline", depth === 0 && "font-medium")}>
							{task.title}
						</Link>
						{task.isBlocked && !kanbanColumnIsDone(status) ? (
							<span role="img" aria-label="Blocked" title="Blocked by an item that is not done" className="inline-flex shrink-0 text-tone-red">
								<Ban aria-hidden className="size-3.5" />
							</span>
						) : null}
						{below === null ? null : <span className="shrink-0 text-xs text-muted-foreground">{below.label}</span>}
					</div>
				</td>
				<td className="px-3 py-1.5">
					<KanbanStatusBadge column={status} />
				</td>
				<td className="px-3 py-1.5">
					<KanbanAssignee person={task.assignee} />
				</td>
				<td className="px-3 py-1.5">
					<KanbanPriorityIcon priority={task.priority} />
				</td>
				<td className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">{points === null ? "—" : pointsLabel(points)}</td>
				<td className="px-3 py-1.5">
					{progress === null ? (
						<span className="text-xs text-muted-foreground">—</span>
					) : (
						<span className="flex items-center gap-2">
							<Progress value={progress} className="h-1 w-16" aria-label={`${task.title}: ${String(progress)}% done`} />
							<span className="w-8 text-xs text-muted-foreground tabular-nums">{progress}%</span>
						</span>
					)}
				</td>
				<td className="px-3 py-1.5 text-xs text-muted-foreground tabular-nums">{dueAt === null ? "—" : formatDueDate(dueAt)}</td>
			</tr>
			{expanded && task.type === "SUBTASK" ? <StepRows task={task} depth={depth + 1} /> : null}
			{expanded ? node.children.map((child) => <TreeRows key={child.task.id} node={child} depth={depth + 1} expansion={expansion} onToggle={onToggle} />) : null}
		</>
	);
}

export interface KanbanHierarchyViewProps {
	readonly filters: KanbanTaskFilters;
}

/**
 * The Hierarchy view: both boards' items as one tree a person opens level by
 * level — epics, their features, the stories under them, their tasks, the
 * tasks' subtasks and a subtask's steps (loaded when it is opened) — each row,
 * named by its level chip and key, with its status,
 * assignee, priority, estimate, progress and due date. A search or filter
 * keeps every match with the path down to it, opened. Read-only: work moves on
 * the boards.
 */
export function KanbanHierarchyView({ filters }: KanbanHierarchyViewProps): React.JSX.Element {
	const { api } = useAuth();
	const planning = api.kanban.board.useQuery({ board: "PLANNING" });
	const execution = api.kanban.board.useQuery({ board: "EXECUTION" });
	const planningColumns = planning.data?.data.columns;
	const executionColumns = execution.data?.data.columns;
	const tree = React.useMemo((): readonly KanbanTreeNode[] | null => {
		if (planningColumns === undefined || executionColumns === undefined) {
			return null;
		}
		const columns: readonly KanbanColumn[] = [...planningColumns, ...executionColumns];
		return filterHierarchy(buildHierarchy(columns), filters);
	}, [executionColumns, filters, planningColumns]);

	const isFiltering = hasActiveFilters(filters);
	// A filtered tree opens fully, so every match shows; otherwise only the top level is open.
	const [expansion, setExpansion] = React.useState<KanbanTreeExpansion | null>(isFiltering ? "all" : null);
	const shownExpansion = React.useMemo(
		(): KanbanTreeExpansion => expansion ?? new Set((tree ?? []).filter((node) => isExpandable(node)).map((node) => node.task.id)),
		[expansion, tree],
	);
	const handleToggle = React.useCallback(
		(id: string): void => {
			const open = shownExpansion === "all" ? new Set(expandableIds(tree ?? [])) : new Set(shownExpansion);
			if (open.has(id)) {
				open.delete(id);
			} else {
				open.add(id);
			}
			setExpansion(open);
		},
		[shownExpansion, tree],
	);
	const expandAll = React.useCallback((): void => {
		setExpansion("all");
	}, []);
	const collapseAll = React.useCallback((): void => {
		setExpansion(new Set());
	}, []);
	const handleRetry = React.useCallback((): void => {
		void planning.refetch();
		void execution.refetch();
	}, [execution, planning]);

	if (tree === null) {
		return planning.isError || execution.isError ? (
			<div role="alert" className="flex flex-col items-start gap-3 p-6">
				<p className="text-sm text-destructive">Could not load the boards.</p>
				<Button variant="outline" onClick={handleRetry}>
					Try again
				</Button>
			</div>
		) : (
			<div className="flex flex-col gap-2 p-4 lg:p-5" aria-hidden>
				{Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
					<Skeleton key={`skeleton-row-${String(index)}`} className="h-8 w-full" />
				))}
			</div>
		);
	}

	return (
		<div className="flex flex-col">
			<div className="flex items-center justify-between gap-3 px-4 py-2 lg:px-5">
				<p className="text-sm text-muted-foreground tabular-nums">{itemCountLabel(countNodes(tree))}</p>
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="sm" onClick={expandAll}>
						<ChevronsUpDown data-icon="inline-start" />
						Expand all
					</Button>
					<Button variant="ghost" size="sm" onClick={collapseAll}>
						<ChevronsDownUp data-icon="inline-start" />
						Collapse all
					</Button>
				</div>
			</div>
			{tree.length === 0 ? (
				<p className="px-4 py-6 text-sm text-muted-foreground lg:px-5">{isFiltering ? "No items match. Clear a filter to see more." : "Nothing on either board yet."}</p>
			) : (
				<div className="overflow-x-auto px-4 pb-6 lg:px-5">
					<table aria-label="Hierarchy" className="w-full min-w-[60rem] border-collapse text-sm">
						<thead>
							<tr className="border-b text-left text-xs text-muted-foreground">
								<th scope="col" className="py-2 pr-3 pl-8 font-medium">
									Item
								</th>
								<th scope="col" className="w-36 px-3 py-2 font-medium">
									Status
								</th>
								<th scope="col" className="w-44 px-3 py-2 font-medium">
									Assignee
								</th>
								<th scope="col" className="w-20 px-3 py-2 font-medium">
									Priority
								</th>
								<th scope="col" className="w-20 px-3 py-2 font-medium">
									Points
								</th>
								<th scope="col" className="w-32 px-3 py-2 font-medium">
									Progress
								</th>
								<th scope="col" className="w-20 px-3 py-2 font-medium">
									Due
								</th>
							</tr>
						</thead>
						<tbody>
							{tree.map((node) => (
								<TreeRows key={node.task.id} node={node} depth={0} expansion={shownExpansion} onToggle={handleToggle} />
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
