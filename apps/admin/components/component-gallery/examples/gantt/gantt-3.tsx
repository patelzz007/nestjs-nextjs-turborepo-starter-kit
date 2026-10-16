"use client";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Gantt, type GanttApi, type GanttTreePanelConfig } from "@workspace/ui/components/gantt/gantt";
import { GanttNav, GanttToolbar } from "@workspace/ui/components/gantt/gantt-nav";
import type { GanttClock, GanttEvent, GanttResource } from "@workspace/ui/components/gantt/gantt-types";
import { GanttView } from "@workspace/ui/components/gantt/gantt-view";
import { addDays, startOfDay, startOfWeek } from "date-fns";
import { PlusIcon } from "lucide-react";
import type * as React from "react";
import { useCallback, useRef, useState } from "react";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so the timeline always opens on the same bars. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const SAMPLE_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};

const TREE_PANEL: GanttTreePanelConfig = { width: 200 };

/** Days after the sample week's start that the first scheduled backlog bar lands on. */
const BACKLOG_FIRST_OFFSET_DAYS = 12;
/** Gap in days between successive scheduled backlog bars. */
const BACKLOG_STAGGER_DAYS = 20;
/** Length in days of each scheduled backlog bar. */
const BACKLOG_BAR_DAYS = 24;

/**
 * Yearly roadmap: each workstream is a swimlane group and its multi-month
 * initiatives are the bars. The Backlog group ships with empty rows - the
 * toolbar button schedules the next one onto the timeline.
 */
const RESOURCES: readonly GanttResource[] = [
	{
		id: "platform",
		title: "Platform",
		children: [
			{ id: "auth-revamp", title: "Auth Revamp" },
			{ id: "api-v2", title: "API v2" },
		],
	},
	{
		id: "growth",
		title: "Growth",
		children: [
			{ id: "onboarding", title: "Onboarding Flow" },
			{ id: "referrals", title: "Referral Program" },
		],
	},
	{
		id: "design-system",
		title: "Design System",
		children: [
			{ id: "tokens", title: "Design Tokens" },
			{ id: "components", title: "Component Library" },
		],
	},
	{
		id: "backlog",
		title: "Backlog",
		children: [
			{ id: "search", title: "Search Revamp" },
			{ id: "billing", title: "Billing v2" },
			{ id: "mobile", title: "Mobile App" },
		],
	},
];

interface BacklogItem {
	readonly id: string;
	readonly title: string;
	readonly color: string;
}

/** Backlog initiatives, scheduled one per click in this order. */
const BACKLOG: readonly BacklogItem[] = [
	{ id: "search", title: "Search Revamp", color: "var(--tone-red)" },
	{ id: "billing", title: "Billing v2", color: "var(--tone-yellow)" },
	{ id: "mobile", title: "Mobile App", color: "var(--tone-orange)" },
];

/** Roadmap fixture - initiatives span months so the quarter axis has something
 *  to show, and offsets straddle the sample day so both past and future are visible. */
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
		bar("auth-revamp", "Auth Revamp", -30, 60, "var(--tone-blue)", 100),
		bar("api-v2", "API v2", 20, 90, "var(--tone-teal)", 30),
		bar("onboarding", "Onboarding Flow", -20, 60, "var(--tone-green)", 80),
		bar("referrals", "Referral Program", 50, 90, "var(--tone-teal)", 0),
		bar("tokens", "Design Tokens", -60, 70, "var(--tone-violet)", 100),
		bar("components", "Component Library", 0, 120, "var(--tone-red)", 45),
	];
}

const BARS: readonly GanttEvent[] = buildBars(SAMPLE_NOW);

/** The first backlog initiative not yet on the timeline, with its position in the backlog. */
function nextUnscheduled(scheduledIds: ReadonlySet<string>): { readonly item: BacklogItem; readonly position: number } | undefined {
	for (const [position, item] of BACKLOG.entries()) {
		if (!scheduledIds.has(`bar-${item.id}`)) {
			return { item, position };
		}
	}
	return undefined;
}

export function Gantt3Example(): React.JSX.Element {
	const apiRef = useRef<GanttApi | null>(null);
	// How many backlog initiatives have been scheduled so far.
	const [scheduled, setScheduled] = useState(0);

	// Schedule the next unscheduled backlog initiative onto its (empty) row.
	// The "next" one is derived from the live events, not a captured counter,
	// so it stays correct even if the button is clicked in quick succession.
	const addInitiative = useCallback((): void => {
		const api = apiRef.current;
		if (api === null) {
			return;
		}
		const next = nextUnscheduled(new Set(api.getEvents().map((event: GanttEvent): string => event.id)));
		if (next === undefined) {
			return;
		}
		const week = startOfWeek(startOfDay(SAMPLE_NOW), { weekStartsOn: 0 });
		// Land the scheduled bars in the near-future part of the current quarter so
		// each one is visible the moment it drops onto its row.
		const start = addDays(week, BACKLOG_FIRST_OFFSET_DAYS + next.position * BACKLOG_STAGGER_DAYS);
		api.addEvent({
			id: `bar-${next.item.id}`,
			title: next.item.title,
			start,
			end: addDays(start, BACKLOG_BAR_DAYS),
			allDay: true,
			color: next.item.color,
			resourceId: next.item.id,
		});
		setScheduled((count: number): number => count + 1);
	}, []);

	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<Gantt defaultEvents={BARS} resources={RESOURCES} defaultScale="quarter" apiRef={apiRef} clock={SAMPLE_CLOCK} treePanel={TREE_PANEL} className="h-[480px] w-full">
						<div className="flex flex-wrap items-center gap-2 border-b pe-3">
							<GanttNav className="min-w-0 flex-1 border-b-0" />
							<GanttToolbar>
								<Button variant="outline" size="sm" onClick={addInitiative} disabled={scheduled >= BACKLOG.length}>
									<PlusIcon className="size-4" aria-hidden="true" />
									Add to roadmap
								</Button>
							</GanttToolbar>
						</div>
						{/* Parent workstream rows carry no bars - summaryBars rolls up the
                child initiatives into one envelope on the group row. */}
						<GanttView />
					</Gantt>
				</CardContent>
			</Card>
		</div>
	);
}
