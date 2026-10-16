"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Gantt, type GanttApi, type GanttColumnContext, type GanttTreePanelConfig } from "@workspace/ui/components/gantt/gantt";
import { GanttNav, GanttToolbar } from "@workspace/ui/components/gantt/gantt-nav";
import type { GanttClock, GanttEvent, GanttResource } from "@workspace/ui/components/gantt/gantt-types";
import { GanttView } from "@workspace/ui/components/gantt/gantt-view";
import { addDays, startOfDay, startOfWeek } from "date-fns";
import { PlusIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useRef } from "react";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so the timeline always opens on the same bars. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const SAMPLE_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};

const TREE_PANEL: GanttTreePanelConfig = { width: 220 };

/** Working days (Mon–Fri) a new assignment can start on, counted from the week's Sunday. */
const ASSIGNMENT_START_DAYS = 5;
/** Length in days of each added assignment. */
const ASSIGNMENT_DAYS = 2;

/**
 * People-centric capacity board: rows are teammates grouped by squad, and
 * each teammate's bars are the week's assignments. The toolbar drops a fresh
 * assignment onto the next teammate, so a person can hold several at once.
 */
const RESOURCES: readonly GanttResource[] = [
	{
		id: "product-squad",
		title: "Product Squad",
		children: [
			{ id: "ada", title: "Ada Lovelace" },
			{ id: "alan", title: "Alan Turing" },
		],
	},
	{
		id: "design-squad",
		title: "Design Squad",
		children: [
			{ id: "grace", title: "Grace Hopper" },
			{ id: "linus", title: "Linus Torvalds" },
		],
	},
];

/** Avatar photo + initials keyed by person id - GanttResource carries no
 *  custom fields, so per-row presentation data lives in a lookup of your own.
 *  The initials show while the image loads or if it fails. */
interface PersonMeta {
	readonly initials: string;
	readonly avatar: string;
}

const RESOURCE_META: ReadonlyMap<string, PersonMeta> = new Map<string, PersonMeta>([
	["ada", { initials: "AL", avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80" }],
	["alan", { initials: "AT", avatar: "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80" }],
	["grace", { initials: "GH", avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80" }],
	["linus", { initials: "LT", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" }],
]);

/** Teammates the new assignments cycle through, and a small pool to name and
 *  color them from. */
const PEOPLE: readonly string[] = ["ada", "alan", "grace", "linus"];

interface PooledTask {
	readonly title: string;
	readonly color: string;
}

const TASK_POOL: readonly PooledTask[] = [
	{ title: "Bug triage", color: "var(--tone-yellow)" },
	{ title: "Code review", color: "var(--tone-red)" },
	{ title: "Spec draft", color: "var(--tone-teal)" },
	{ title: "Pairing", color: "var(--tone-orange)" },
];

/** This-week assignments per teammate - day-precise bars for a capacity read
 *  (progress omitted; occupancy, not percent-done, is the point here). */
function buildBars(anchor: Date): readonly GanttEvent[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: 0 });
	const day = (dayOffset: number): Date => addDays(week, dayOffset);
	const bar = (resourceId: string, title: string, startOffset: number, days: number, color: string): GanttEvent => ({
		id: `bar-${resourceId}`,
		title,
		start: day(startOffset),
		end: day(startOffset + days),
		allDay: true,
		color,
		resourceId,
	});

	return [
		bar("ada", "Checkout API", -1, 3, "var(--tone-blue)"),
		bar("alan", "Search Indexing", 0, 3, "var(--tone-teal)"),
		bar("grace", "Dashboard Redesign", 1, 3, "var(--tone-violet)"),
		bar("linus", "Infra Migration", -2, 3, "var(--tone-green)"),
	];
}

const BARS: readonly GanttEvent[] = buildBars(SAMPLE_NOW);

/** People rows get an avatar label; group (squad) rows return undefined to keep the default plain-title label. */
function renderResourceLabel({ resource, isGroup }: GanttColumnContext): React.ReactNode {
	if (isGroup) {
		return undefined;
	}
	const person = RESOURCE_META.get(resource.id);
	return (
		<span className="flex min-w-0 items-center gap-2">
			<Avatar className="size-5">
				<AvatarImage src={person?.avatar} alt={resource.title} />
				<AvatarFallback className="text-xs">{person?.initials ?? resource.title.charAt(0)}</AvatarFallback>
			</Avatar>
			<span className="truncate">{resource.title}</span>
		</span>
	);
}

export function Gantt4Example(): React.JSX.Element {
	const apiRef = useRef<GanttApi | null>(null);
	// A ref (not state) counts the adds, so it advances synchronously and stays
	// correct even when the button is clicked several times in a row.
	const addedRef = useRef(0);

	// Add a 2-day assignment to the next teammate in rotation. Successive adds
	// to the same person overlap and stack into extra lanes on that row.
	const addAssignment = useCallback((): void => {
		const api = apiRef.current;
		if (api === null) {
			return;
		}
		const n = addedRef.current;
		addedRef.current = n + 1;
		const person = PEOPLE[n % PEOPLE.length];
		const task = TASK_POOL[n % TASK_POOL.length];
		if (person === undefined || task === undefined) {
			return;
		}
		const week = startOfWeek(startOfDay(SAMPLE_NOW), { weekStartsOn: 0 });
		const start = addDays(week, (n % ASSIGNMENT_START_DAYS) + 1);
		api.addEvent({
			id: `bar-extra-${String(n)}`,
			title: task.title,
			start,
			end: addDays(start, ASSIGNMENT_DAYS),
			allDay: true,
			color: task.color,
			resourceId: person,
		});
	}, []);

	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<Gantt
						defaultEvents={BARS}
						resources={RESOURCES}
						defaultScale="week"
						apiRef={apiRef}
						clock={SAMPLE_CLOCK}
						// Weekends shaded so booked working-day capacity is obvious.
						offDays
						treePanel={TREE_PANEL}
						renderResourceLabel={renderResourceLabel}
						className="h-[440px] w-full">
						<div className="flex flex-wrap items-center gap-2 border-b pe-3">
							<GanttNav className="min-w-0 flex-1 border-b-0" />
							<GanttToolbar>
								<Button variant="outline" size="sm" onClick={addAssignment}>
									<PlusIcon className="size-4" aria-hidden="true" />
									Add assignment
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
