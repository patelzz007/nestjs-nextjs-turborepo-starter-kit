"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import type { KanbanTask } from "@workspace/shared";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import { SquareCheck, ChevronRight, Square } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

import { childCountOf } from "../lib/kanban-display";
import { KanbanLevelChip, KanbanStatusBadge } from "./kanban-task-badges";
import { KanbanAssignee } from "./kanban-person";

/** How far each step level is indented under its subtask. */
const STEP_INDENT_CLASS: readonly string[] = ["", "pl-4"];

/** What opens under a card: its child items (each with its level, key and status), or a subtask's steps; loaded on first open. */
function CardChildrenList({ taskId }: { readonly taskId: string }): React.JSX.Element {
	const { api } = useAuth();
	const query = api.kanban.task.useQuery({ taskId });
	const detail = query.data?.data;
	if (detail === undefined) {
		return query.isError ? (
			<p className="px-1 text-xs text-destructive">Could not load what sits below.</p>
		) : (
			<div className="flex flex-col gap-1.5" aria-hidden>
				<Skeleton className="h-6 w-full" />
				<Skeleton className="h-6 w-4/5" />
			</div>
		);
	}
	if (detail.type === "SUBTASK") {
		return (
			<ul aria-label={`Steps of ${detail.title}`} className="flex flex-col">
				{detail.stepItems.map((row) => (
					<li key={row.id} className={cn("flex items-center gap-2 rounded px-1 py-1 text-xs", STEP_INDENT_CLASS.at(row.depth))}>
						{row.isDone ? (
							<SquareCheck aria-hidden className="size-3.5 shrink-0 text-tone-green" />
						) : (
							<Square aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
						)}
						<span className="sr-only">{row.isDone ? "Done:" : "Open:"}</span>
						<span className={cn("min-w-0 flex-1 truncate", row.isDone && "text-muted-foreground line-through")}>{row.title}</span>
						{row.assignee === null ? null : <KanbanAssignee person={row.assignee} compact />}
					</li>
				))}
			</ul>
		);
	}
	return (
		<ul aria-label={`Items under ${detail.title}`} className="flex flex-col">
			{detail.children.map((child) => (
				<li key={child.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/60">
					<KanbanLevelChip type={child.type} itemKey={child.key} />
					<Link href={ROUTES.kanban.task(child.id)} className="min-w-0 flex-1 truncate text-xs hover:underline" draggable={false}>
						{child.title}
					</Link>
					<KanbanStatusBadge column={child.column} size="sm" />
					<KanbanAssignee person={child.assignee} compact />
				</li>
			))}
		</ul>
	);
}

/**
 * The card's expander: "3 tasks" (or "2 stories", a subtask's "4 steps") with how many
 * are done, opening the list right on the card the way a tracker shows child
 * issues. Nothing when nothing sits below the item.
 */
export function KanbanCardChildren({ task }: { readonly task: KanbanTask }): React.JSX.Element | null {
	const [isOpen, setIsOpen] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setIsOpen((open) => !open);
	}, []);
	const children = childCountOf(task);
	if (children === null) {
		return null;
	}
	const tally = task.type === "SUBTASK" ? task.steps : task.rollup.children;
	const listId = `kanban-card-children-${task.id}`;
	return (
		<div className="-mx-1 flex flex-col gap-1 border-t pt-1.5">
			<button
				type="button"
				aria-expanded={isOpen}
				aria-controls={listId}
				onClick={toggle}
				className="flex items-center gap-1 rounded px-1 py-0.5 text-left text-xs text-muted-foreground transition-colors outline-none hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
				<ChevronRight aria-hidden className={cn("size-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-90")} />
				<span className="font-medium">{children.label}</span>
				<span className="ml-auto tabular-nums">
					{tally.done}/{tally.total} done
				</span>
			</button>
			{isOpen ? (
				<div id={listId}>
					<CardChildrenList taskId={task.id} />
				</div>
			) : null}
		</div>
	);
}
