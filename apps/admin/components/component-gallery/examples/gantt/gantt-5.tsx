"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Gantt, type GanttApi, type GanttColumn, type GanttColumnContext, type GanttTreePanelConfig } from "@workspace/ui/components/gantt/gantt";
import { GanttNav, GanttToolbar } from "@workspace/ui/components/gantt/gantt-nav";
import type { GanttClock, GanttEvent, GanttInteractions, GanttResource } from "@workspace/ui/components/gantt/gantt-types";
import { GanttView } from "@workspace/ui/components/gantt/gantt-view";
import { addDays, startOfDay, startOfWeek } from "date-fns";
import { PlusIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useMemo, useRef, useState } from "react";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so the timeline always opens on the same bars. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const SAMPLE_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};

// Wider tree with a tighter name column so the Owner avatar, owner name and
// Status all fit alongside the task names.
const TREE_PANEL: GanttTreePanelConfig = { width: 400, nameColumnWidth: 150 };

// Read-only timeline: drag, resize and slot-select are off so the plan can't
// be shifted by dragging; rows are added via the toolbar.
const READ_ONLY_INTERACTIONS: Partial<GanttInteractions> = { drag: false, resize: false, selectSlot: false };

const OWNER_COLUMN_WIDTH = 130;
const STATUS_COLUMN_WIDTH = 100;
/** Letters a single-word owner name contributes to its avatar fallback. */
const SINGLE_NAME_INITIALS = 2;
/** New tasks start within a six-day window around the sample week's start... */
const NEW_TASK_START_WINDOW_DAYS = 6;
/** ...shifted this many days earlier, so some land before the now-line. */
const NEW_TASK_START_SHIFT_DAYS = 2;
/** Length in days of each appended task bar. */
const NEW_TASK_DAYS = 5;
/** The tree group new tasks are appended under. */
const NEW_TASK_GROUP_ID = "launch";

type TaskStatus = "Done" | "In progress" | "Not started";

interface TaskMeta {
	readonly owner: string;
	readonly status: TaskStatus;
}

/** Owner headshots keyed by name. Missing entries (e.g. "Unassigned") fall
 *  back to initials, and the initials also show while the photo loads. */
const OWNER_AVATARS: ReadonlyMap<string, string> = new Map<string, string>([
	["Ada Lovelace", "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80"],
	["Grace Hopper", "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80"],
	["Alan Turing", "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80"],
	["Linus Torvalds", "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80"],
	["Katherine Johnson", "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80"],
]);

/** First + last initial from an owner name, used as the avatar fallback -
 *  "Ada Lovelace" reads "AL", "Unassigned" reads "UN". */
function ownerInitials(name: string): string {
	const [first, ...rest] = name
		.trim()
		.split(/\s+/)
		.filter((part: string): boolean => part.length > 0);
	if (first === undefined) {
		return "?";
	}
	const last = rest.pop();
	if (last === undefined) {
		return first.slice(0, SINGLE_NAME_INITIALS).toUpperCase();
	}
	return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/** Status label -> badge light variant (green done, amber in progress, neutral not started). */
const STATUS_VARIANT: Readonly<Record<TaskStatus, BadgeVariant>> = {
	Done: "success-light",
	"In progress": "warning-light",
	"Not started": "secondary",
};

/**
 * Status report: the left tree panel doubles as a task table with Owner and
 * Status columns beside each phase, every bar carries a progress fill, and the
 * timeline is drag-locked. New tasks are appended as rows from the toolbar.
 */
const INITIAL_RESOURCES: readonly GanttResource[] = [
	{
		id: "planning",
		title: "Planning",
		children: [
			{ id: "requirements", title: "Requirements" },
			{ id: "design-phase", title: "Design" },
		],
	},
	{
		id: "build",
		title: "Build",
		children: [
			{ id: "frontend", title: "Frontend" },
			{ id: "backend", title: "Backend" },
		],
	},
	{
		id: "launch",
		title: "Launch",
		children: [
			{ id: "qa", title: "QA & Testing" },
			{ id: "rollout", title: "Rollout" },
		],
	},
];

/** Owner + status per task, keyed by resource.id - GanttResource has no room
 *  for custom fields, so the extra column data lives in a lookup of your own. */
const INITIAL_META: ReadonlyMap<string, TaskMeta> = new Map<string, TaskMeta>([
	["requirements", { owner: "Ada Lovelace", status: "Done" }],
	["design-phase", { owner: "Grace Hopper", status: "Done" }],
	["frontend", { owner: "Alan Turing", status: "In progress" }],
	["backend", { owner: "Linus Torvalds", status: "In progress" }],
	["qa", { owner: "Katherine Johnson", status: "Not started" }],
	["rollout", { owner: "Margaret Hamilton", status: "Not started" }],
]);

/** Status-report fixture - progress descends from finished planning to
 *  not-started launch, and the phases straddle the sample day so the now-line falls
 *  mid-plan. Kept inside a month so every phase reads at a glance. */
function buildBars(anchor: Date): readonly GanttEvent[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: 0 });
	const day = (dayOffset: number): Date => addDays(week, dayOffset);
	const bar = (resourceId: string, title: string, startOffset: number, days: number, color: string, progress?: number): GanttEvent => ({
		id: `bar-${resourceId}`,
		title,
		start: day(startOffset),
		end: day(startOffset + days),
		allDay: true,
		color,
		resourceId,
		progress,
	});

	return [
		bar("requirements", "Requirements", -10, 8, "var(--tone-blue)", 100),
		bar("design-phase", "Design", -8, 8, "var(--tone-teal)", 100),
		bar("frontend", "Frontend", -2, 10, "var(--tone-violet)", 60),
		bar("backend", "Backend", 0, 10, "var(--tone-red)", 45),
		bar("qa", "QA & Testing", 8, 8, "var(--tone-yellow)", 0),
		bar("rollout", "Rollout", 14, 5, "var(--tone-green)", 0),
	];
}

const BARS: readonly GanttEvent[] = buildBars(SAMPLE_NOW);

/** Extra tree-panel columns after the pinned name column. Built from meta so
 *  appended rows pick up their Owner and Status; group rows return null. */
function buildColumns(meta: ReadonlyMap<string, TaskMeta>): readonly GanttColumn[] {
	return [
		{
			id: "owner",
			title: "Owner",
			width: OWNER_COLUMN_WIDTH,
			align: "start",
			render: ({ resource, isGroup }: GanttColumnContext): React.ReactNode => {
				const owner = isGroup ? undefined : meta.get(resource.id)?.owner;
				if (owner === undefined) {
					return null;
				}
				return (
					<span className="flex min-w-0 items-center gap-2">
						<Avatar className="size-5 shrink-0">
							<AvatarImage src={OWNER_AVATARS.get(owner)} alt={owner} />
							<AvatarFallback className="text-xs">{ownerInitials(owner)}</AvatarFallback>
						</Avatar>
						<span className="truncate">{owner}</span>
					</span>
				);
			},
		},
		{
			id: "status",
			title: "Status",
			width: STATUS_COLUMN_WIDTH,
			align: "start",
			render: ({ resource, isGroup }: GanttColumnContext): React.ReactNode => {
				const status = isGroup ? undefined : meta.get(resource.id)?.status;
				if (status === undefined) {
					return null;
				}
				return (
					<Badge variant={STATUS_VARIANT[status]} size="sm">
						{status}
					</Badge>
				);
			},
		},
	];
}

/** Appends a new leaf row under the given group, leaving every other group untouched. */
function appendChild(resources: readonly GanttResource[], groupId: string, child: GanttResource): readonly GanttResource[] {
	return resources.map((group: GanttResource): GanttResource => (group.id === groupId ? { ...group, children: [...(group.children ?? []), child] } : group));
}

export function Gantt5Example(): React.JSX.Element {
	const apiRef = useRef<GanttApi | null>(null);
	const [resources, setResources] = useState<readonly GanttResource[]>(INITIAL_RESOURCES);
	const [meta, setMeta] = useState<ReadonlyMap<string, TaskMeta>>(INITIAL_META);
	// A ref (not state) numbers each appended task, so ids stay unique even when
	// the button is clicked several times before a re-render.
	const addedRef = useRef(0);

	const columns = useMemo((): readonly GanttColumn[] => buildColumns(meta), [meta]);

	// Append a new task as its own row under the Launch phase, register its
	// Owner/Status, and drop a not-started bar on its row.
	const addTask = useCallback((): void => {
		const api = apiRef.current;
		if (api === null) {
			return;
		}
		const n = addedRef.current + 1;
		addedRef.current = n;
		const id = `task-${String(n)}`;
		const title = `New task ${String(n)}`;
		setResources((prev: readonly GanttResource[]): readonly GanttResource[] => appendChild(prev, NEW_TASK_GROUP_ID, { id, title }));
		setMeta((prev: ReadonlyMap<string, TaskMeta>): ReadonlyMap<string, TaskMeta> => new Map(prev).set(id, { owner: "Unassigned", status: "Not started" }));
		const week = startOfWeek(startOfDay(SAMPLE_NOW), { weekStartsOn: 0 });
		const start = addDays(week, (n % NEW_TASK_START_WINDOW_DAYS) - NEW_TASK_START_SHIFT_DAYS);
		api.addEvent({
			id: `bar-${id}`,
			title,
			start,
			end: addDays(start, NEW_TASK_DAYS),
			allDay: true,
			color: "var(--muted-foreground)",
			resourceId: id,
			progress: 0,
		});
	}, []);

	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<Gantt
						defaultEvents={BARS}
						resources={resources}
						defaultScale="month"
						apiRef={apiRef}
						clock={SAMPLE_CLOCK}
						defaultInteractions={READ_ONLY_INTERACTIONS}
						columns={columns}
						treePanel={TREE_PANEL}
						className="h-[500px] w-full">
						<div className="flex flex-wrap items-center gap-2 border-b pe-3">
							<GanttNav className="min-w-0 flex-1 border-b-0" />
							<GanttToolbar>
								<Button variant="outline" size="sm" onClick={addTask}>
									<PlusIcon className="size-4" aria-hidden="true" />
									Add task
								</Button>
							</GanttToolbar>
						</div>
						<GanttView />
					</Gantt>
				</CardContent>
			</Card>
		</div>
	);
}
