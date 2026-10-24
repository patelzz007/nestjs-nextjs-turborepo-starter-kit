"use client";

import { useAuth } from "@workspace/client/lib/contexts/identity";
import { KANBAN_CHILD_TYPE, kanbanColumnIsDone, type KanbanTaskDetail } from "@workspace/shared";
import { AvatarGroup, AvatarGroupCount } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import {
	CalendarDays,
	CircleDot,
	Clock,
	CornerLeftUp,
	Eye,
	EyeOff,
	Flag,
	Gauge,
	Hash,
	ListChecks,
	PenLine,
	Shapes,
	Tag,
	UserRound,
	UserRoundPen,
	Users,
	type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { toastMutationError } from "@/lib/api/mutation-error";
import { formatDateTime } from "@/lib/format/dates";
import { ROUTES } from "@/lib/routes";

import { effectiveSchedule, formatDateRange, isOverdue, KANBAN_TYPE_DISPLAY, percentOf, pointsLabel } from "../lib/kanban-display";
import { useKanbanItemUpdate } from "../lib/use-kanban-item-update";
import { KanbanAssignee, KanbanPersonAvatar } from "./kanban-person";
import { KanbanLabelChips, KanbanLevelChip, KanbanPriorityBadge, KanbanStatusBadge, KanbanTeamBadge, KanbanTypeBadge } from "./kanban-task-badges";

/** Watchers drawn as avatars before folding the rest into "+n". */
const WATCHER_AVATAR_LIMIT = 5;

interface PropertyProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly children: React.ReactNode;
}

/** One property row: a quiet icon and name on the left, the value on the right, as a document page lists them. */
function Property({ icon: Icon, label, children }: PropertyProps): React.JSX.Element {
	return (
		<div className="-mx-2 grid min-h-9 grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-muted/50 sm:grid-cols-[11rem_minmax(0,1fr)]">
			<dt className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
				<Icon aria-hidden className="size-4 shrink-0" />
				<span className="truncate">{label}</span>
			</dt>
			<dd className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">{children}</dd>
		</div>
	);
}

function Empty({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
	return <span className="text-muted-foreground">{children}</span>;
}

/** A tally as a thin bar and "done of total" — how a rolled-up measure reads in a property row; "None yet" with nothing to count. */
function Tally({ done, total, unit }: { readonly done: number; readonly total: number; readonly unit: string }): React.JSX.Element {
	if (total === 0) {
		return <Empty>None yet</Empty>;
	}
	return (
		<span className="flex w-full max-w-sm items-center gap-2">
			<Progress value={percentOf(done, total)} className="h-1.5 flex-1" aria-label={`${unit}: ${String(done)} of ${String(total)}`} />
			<span className="shrink-0 text-muted-foreground tabular-nums">
				{done} of {total} {unit}
			</span>
		</span>
	);
}

/**
 * The item's properties under its title, one row each: status, level and
 * parent, people, priority and team, dates, the estimate, how far it has got
 * (its own progress and, by its level, its children, story points, steps or
 * criteria), labels, watchers, and when it was made and last edited.
 */
export function KanbanTaskProperties({ task, now }: { readonly task: KanbanTaskDetail; readonly now: number }): React.JSX.Element {
	const schedule = effectiveSchedule(task);
	const isDone = kanbanColumnIsDone(task.column);
	const parent = task.ancestors.at(task.ancestors.length - 1);
	const childType = KANBAN_CHILD_TYPE[task.type];
	const hiddenWatchers = task.watchers.length - WATCHER_AVATAR_LIMIT;
	return (
		<dl className="flex flex-col">
			<Property icon={CircleDot} label="Status">
				<KanbanStatusBadge column={task.column} />
			</Property>
			<Property icon={Shapes} label="Type">
				<KanbanTypeBadge type={task.type} />
			</Property>
			<Property icon={CornerLeftUp} label="Parent">
				{parent === undefined ? (
					<Empty>{task.type === "EPIC" ? "Top level" : "None"}</Empty>
				) : (
					<span className="flex min-w-0 items-center gap-2">
						<KanbanLevelChip type={parent.type} itemKey={parent.key} />
						<Link href={ROUTES.kanban.task(parent.id)} className="truncate underline decoration-border underline-offset-4 hover:decoration-foreground">
							<span className="sr-only">{KANBAN_TYPE_DISPLAY[parent.type].label}: </span>
							{parent.title}
						</Link>
					</span>
				)}
			</Property>
			<Property icon={UserRound} label="Assignee">
				<KanbanAssignee person={task.assignee} />
			</Property>
			<Property icon={UserRoundPen} label="Reporter">
				<KanbanAssignee person={task.owner} />
			</Property>
			<Property icon={Flag} label="Priority">
				<KanbanPriorityBadge priority={task.priority} />
			</Property>
			<Property icon={Users} label="Team">
				<KanbanTeamBadge team={task.team} />
			</Property>
			<Property icon={CalendarDays} label="Dates">
				{schedule.startAt === null && schedule.dueAt === null ? (
					<Empty>No dates</Empty>
				) : (
					<span className="tabular-nums">{formatDateRange(schedule.startAt, schedule.dueAt)}</span>
				)}
				{isOverdue(schedule.dueAt, isDone, now) ? (
					<Badge variant="destructive-light" className="rounded-md px-1.5">
						Overdue
					</Badge>
				) : null}
				{schedule.inheritedFrom === null ? null : <span className="text-xs text-muted-foreground">from the story “{schedule.inheritedFrom.title}”</span>}
			</Property>
			<Property icon={Hash} label={task.type === "STORY" ? "Story points" : "Points"}>
				{task.type === "STORY" ? (
					task.storyPoints === null ? (
						<Empty>Not estimated</Empty>
					) : (
						<span className="tabular-nums">{pointsLabel(task.storyPoints)}</span>
					)
				) : task.type === "TASK" ? (
					<Empty>Counted on its story</Empty>
				) : (
					<Tally done={task.rollup.points.done} total={task.rollup.points.total} unit="pts done" />
				)}
			</Property>
			<Property icon={Gauge} label="Progress">
				<span className="flex w-full max-w-sm items-center gap-2">
					<Progress value={task.progress} className="h-1.5 flex-1" aria-label="Progress" />
					<span className="w-9 shrink-0 text-right text-muted-foreground tabular-nums">{task.progress}%</span>
				</span>
			</Property>
			{childType === null ? null : (
				<Property icon={ListChecks} label={`${KANBAN_TYPE_DISPLAY[childType].plural} done`}>
					<Tally done={task.rollup.children.done} total={task.rollup.children.total} unit={KANBAN_TYPE_DISPLAY[childType].plural.toLowerCase()} />
				</Property>
			)}
			{task.type === "SUBTASK" ? (
				<Property icon={ListChecks} label="Steps done">
					<Tally done={task.steps.done} total={task.steps.total} unit="steps" />
				</Property>
			) : null}
			{task.type === "FEATURE" || task.type === "STORY" ? (
				<Property icon={ListChecks} label="Criteria met">
					<Tally done={task.acceptanceCriteria.done} total={task.acceptanceCriteria.total} unit="criteria" />
				</Property>
			) : null}
			<Property icon={Tag} label="Labels">
				{task.labels.length === 0 ? <Empty>None</Empty> : <KanbanLabelChips labels={task.labels} />}
			</Property>
			<Property icon={Eye} label="Watchers">
				{task.watchers.length === 0 ? (
					<Empty>Nobody yet</Empty>
				) : (
					<AvatarGroup role="group" aria-label="Watchers">
						{task.watchers.slice(0, WATCHER_AVATAR_LIMIT).map((person) => (
							<KanbanPersonAvatar key={person.id} person={person} isNamed />
						))}
						{hiddenWatchers > 0 ? <AvatarGroupCount className="size-6 text-xs">+{hiddenWatchers}</AvatarGroupCount> : null}
					</AvatarGroup>
				)}
			</Property>
			<Property icon={Clock} label="Created">
				<span className="text-muted-foreground">{formatDateTime(task.createdAt)}</span>
			</Property>
			<Property icon={PenLine} label="Last edited">
				<span className="text-muted-foreground">{formatDateTime(task.updatedAt)}</span>
			</Property>
		</dl>
	);
}

/** Watch or stop watching the item, with how many people watch it. */
export function KanbanWatchButton({ task }: { readonly task: KanbanTaskDetail }): React.JSX.Element {
	const { api } = useAuth();
	const onUpdated = useKanbanItemUpdate(task.id);
	const onFailed = React.useCallback((error: Error): void => {
		toastMutationError("Could not change your watch", error);
	}, []);
	const watch = api.kanban.watch.useMutation({ onSuccess: onUpdated, onError: onFailed });
	const unwatch = api.kanban.unwatch.useMutation({ onSuccess: onUpdated, onError: onFailed });
	const handleClick = React.useCallback((): void => {
		if (task.isWatching) {
			unwatch.mutate({ taskId: task.id });
		} else {
			watch.mutate({ taskId: task.id });
		}
	}, [task.id, task.isWatching, unwatch, watch]);
	return (
		<Button variant="ghost" size="sm" aria-pressed={task.isWatching} disabled={watch.isPending || unwatch.isPending} onClick={handleClick}>
			{task.isWatching ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
			{task.isWatching ? "Unwatch" : "Watch"}
			<span className="text-muted-foreground tabular-nums">{task.watchers.length}</span>
		</Button>
	);
}
