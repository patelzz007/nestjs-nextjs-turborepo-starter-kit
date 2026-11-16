import type { GanttEvent, GanttResource } from "@workspace/ui-kit-logic";
import { Button } from "@workspace/ui-native/components/button";
import { Gantt } from "@workspace/ui-native/components/gantt";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";

import { SAMPLE_CLOCK, sampleBar } from "./gantt-sample";

/** Days after the sample Sunday that the first scheduled backlog bar lands on, the gap between them, and their length. */
const BACKLOG_FIRST_OFFSET_DAYS = 12;
const BACKLOG_STAGGER_DAYS = 20;
const BACKLOG_BAR_DAYS = 24;

/** A yearly roadmap: each workstream a group, its multi-month initiatives the bars; the Backlog's rows start empty. */
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

/** Backlog initiatives, scheduled one per tap in this order. */
const BACKLOG: readonly BacklogItem[] = [
	{ id: "search", title: "Search Revamp", color: "red" },
	{ id: "billing", title: "Billing v2", color: "yellow" },
	{ id: "mobile", title: "Mobile App", color: "orange" },
];

const BARS: readonly GanttEvent[] = [
	sampleBar("auth-revamp", "Auth Revamp", -30, 60, "blue", 100),
	sampleBar("api-v2", "API v2", 20, 90, "teal", 30),
	sampleBar("onboarding", "Onboarding Flow", -20, 60, "green", 80),
	sampleBar("referrals", "Referral Program", 50, 90, "teal", 0),
	sampleBar("tokens", "Design Tokens", -60, 70, "violet", 100),
	sampleBar("components", "Component Library", 0, 120, "red", 45),
];

// The quarter view: groups roll their initiatives up; the toolbar button drops the next backlog item onto its row.
export function Gantt3Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly GanttEvent[]>(BARS);
	const next = BACKLOG.find((item): boolean => !events.some((event): boolean => event.resourceId === item.id));
	const position = next === undefined ? -1 : BACKLOG.indexOf(next);
	const schedule = React.useCallback((): void => {
		if (next !== undefined) {
			setEvents((current): readonly GanttEvent[] => [
				...current,
				sampleBar(next.id, next.title, BACKLOG_FIRST_OFFSET_DAYS + position * BACKLOG_STAGGER_DAYS, BACKLOG_BAR_DAYS, next.color),
			]);
		}
	}, [next, position]);
	const toolbar = <Button label="Schedule next" icon={PlusIcon} size="sm" variant="outline" onPress={schedule} disabled={next === undefined} />;
	return <Gantt events={events} onEventsChange={setEvents} resources={RESOURCES} defaultScale="quarter" clock={SAMPLE_CLOCK} treeWidth="md" toolbarContent={toolbar} />;
}
