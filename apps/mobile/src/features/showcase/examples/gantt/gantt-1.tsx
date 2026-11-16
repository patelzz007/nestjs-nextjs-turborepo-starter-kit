import type { GanttEvent, GanttResource, WeekStartsOn } from "@workspace/ui-kit-logic";
import { Button } from "@workspace/ui-native/components/button";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Gantt } from "@workspace/ui-native/components/gantt";
import PlusIcon from "lucide-react-native/icons/plus";
import Settings2Icon from "lucide-react-native/icons/settings-2";
import * as React from "react";

import { SAMPLE_CLOCK, sampleBar } from "./gantt-sample";

/** A plan whose rows wait to be scheduled: the toolbar puts the next task on the timeline. */
const RESOURCES: readonly GanttResource[] = [
	{
		id: "planning",
		title: "Planning",
		children: [
			{ id: "brief", title: "Project brief" },
			{ id: "scope", title: "Scope review" },
		],
	},
	{
		id: "design",
		title: "Design",
		children: [
			{ id: "wireframes", title: "Wireframes" },
			{ id: "visual-design", title: "Visual design" },
		],
	},
	{
		id: "build",
		title: "Build",
		children: [
			{ id: "frontend", title: "Frontend" },
			{ id: "backend", title: "Backend" },
			{ id: "qa", title: "QA pass" },
			{ id: "release-prep", title: "Release prep" },
		],
	},
	{
		id: "launch",
		title: "Launch",
		children: [
			{ id: "docs", title: "Docs" },
			{ id: "marketing-site", title: "Marketing site" },
			{ id: "announcement", title: "Announcement" },
		],
	},
];

/** The rows in schedule order, each with a colour, landing two days after the one before. */
const QUEUE: readonly { readonly id: string; readonly title: string; readonly color: string }[] = [
	{ id: "brief", title: "Project brief", color: "blue" },
	{ id: "scope", title: "Scope review", color: "teal" },
	{ id: "wireframes", title: "Wireframes", color: "violet" },
	{ id: "visual-design", title: "Visual design", color: "red" },
	{ id: "frontend", title: "Frontend", color: "green" },
	{ id: "backend", title: "Backend", color: "teal" },
	{ id: "qa", title: "QA pass", color: "yellow" },
	{ id: "release-prep", title: "Release prep", color: "orange" },
	{ id: "docs", title: "Docs", color: "blue" },
	{ id: "marketing-site", title: "Marketing site", color: "violet" },
	{ id: "announcement", title: "Announcement", color: "green" },
];
const TASK_DAYS = 3;
const TASK_STAGGER_DAYS = 2;
/** The first task starts this many days before the sample Sunday. */
const FIRST_OFFSET_DAYS = -6;

type Setting = "today" | "weekends" | "dependencies" | "baselines" | "rollups" | "monday";
type TimeZoneChoice = "local" | "America/New_York" | "Europe/London" | "Asia/Tokyo" | "Asia/Kolkata";
type MenuValue = Setting | `zone:${TimeZoneChoice}`;

const TIME_ZONES: readonly { readonly value: TimeZoneChoice; readonly label: string }[] = [
	{ value: "local", label: "This device" },
	{ value: "America/New_York", label: "New York" },
	{ value: "Europe/London", label: "London" },
	{ value: "Asia/Tokyo", label: "Tokyo" },
	{ value: "Asia/Kolkata", label: "Kolkata" },
];

const SETTINGS: readonly { readonly value: Setting; readonly label: string }[] = [
	{ value: "today", label: "Today line" },
	{ value: "weekends", label: "Shade weekends" },
	{ value: "dependencies", label: "Dependency arrows" },
	{ value: "baselines", label: "Planned bars" },
	{ value: "rollups", label: "Group rollups" },
	{ value: "monday", label: "Week starts Monday" },
];

const MONDAY: WeekStartsOn = 1;
const SUNDAY: WeekStartsOn = 0;

// A settings menu over the chart: display switches and a time zone, each applied at once.
export function Gantt1Example(): React.JSX.Element {
	const [settings, setSettings] = React.useState<ReadonlySet<Setting>>(() => new Set<Setting>(["today", "weekends", "dependencies", "baselines", "rollups"]));
	const [zone, setZone] = React.useState<TimeZoneChoice>("local");
	const [events, setEvents] = React.useState<readonly GanttEvent[]>([]);
	const items = React.useMemo(
		(): DropdownMenuItemData<MenuValue>[] => [
			...SETTINGS.map((entry): DropdownMenuItemData<MenuValue> => ({
				value: entry.value,
				label: entry.label,
				kind: "checkbox",
				checked: settings.has(entry.value),
				group: "Display",
			})),
			...TIME_ZONES.map((entry): DropdownMenuItemData<MenuValue> => ({
				value: `zone:${entry.value}`,
				label: entry.label,
				kind: "radio",
				checked: zone === entry.value,
				group: "Time zone",
			})),
		],
		[settings, zone],
	);
	const choose = React.useCallback((value: MenuValue): void => {
		const picked = TIME_ZONES.find((entry): boolean => `zone:${entry.value}` === value);
		if (picked !== undefined) {
			setZone(picked.value);
			return;
		}
		setSettings((current): ReadonlySet<Setting> => {
			const next = new Set(current);
			const setting = SETTINGS.find((entry): boolean => entry.value === value)?.value;
			if (setting !== undefined && !next.delete(setting)) {
				next.add(setting);
			}
			return next;
		});
	}, []);
	const next = QUEUE.at(events.length);
	const schedule = React.useCallback((): void => {
		if (next !== undefined) {
			setEvents((current): readonly GanttEvent[] => [
				...current,
				sampleBar(next.id, next.title, FIRST_OFFSET_DAYS + current.length * TASK_STAGGER_DAYS, TASK_DAYS, next.color),
			]);
		}
	}, [next]);
	const toolbar = (
		<>
			<Button label="Add task" icon={PlusIcon} size="sm" variant="outline" onPress={schedule} disabled={next === undefined} />
			<DropdownMenu label="Settings" title="Settings" items={items} onSelect={choose} icon={Settings2Icon} size="sm" />
		</>
	);
	return (
		<Gantt
			events={events}
			onEventsChange={setEvents}
			resources={RESOURCES}
			defaultScale="month"
			clock={SAMPLE_CLOCK}
			timeZone={zone === "local" ? undefined : zone}
			weekStartsOn={settings.has("monday") ? MONDAY : SUNDAY}
			showToday={settings.has("today")}
			offDays={settings.has("weekends")}
			dependencies={settings.has("dependencies")}
			baselineBars={settings.has("baselines")}
			summaryBars={settings.has("rollups")}
			toolbarContent={toolbar}
		/>
	);
}
