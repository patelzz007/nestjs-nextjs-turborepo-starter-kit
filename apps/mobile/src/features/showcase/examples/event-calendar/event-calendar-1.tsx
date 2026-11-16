import type { CalendarEvent, CalendarView, EventCalendarWeekStartsOn } from "@workspace/ui-kit-logic";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { EventCalendar } from "@workspace/ui-native/components/event-calendar";
import Settings2Icon from "lucide-react-native/icons/settings-2";
import * as React from "react";

import { atHour, SAMPLE_CLOCK } from "./event-calendar-sample";

/** A busy fortnight: timed meetings, an all-day trip and a long workshop, around the sample day. */
const EVENTS: readonly CalendarEvent[] = [
	{ id: "standup", title: "Standup", start: atHour(3, 9), end: atHour(3, 9.25), color: "teal", recurrence: "FREQ=DAILY;COUNT=10" },
	{ id: "planning", title: "Sprint planning", start: atHour(1, 10), end: atHour(1, 12), color: "blue" },
	{ id: "review", title: "Design review", start: atHour(3, 11), end: atHour(3, 12), color: "violet" },
	{ id: "lunch", title: "Team lunch", start: atHour(3, 12.5), end: atHour(3, 13.5), color: "green" },
	{ id: "workshop", title: "Workshop", start: atHour(4, 13), end: atHour(4, 17), color: "orange" },
	{ id: "offsite", title: "Offsite", start: atHour(8, 0), end: atHour(10, 0), allDay: true, color: "red" },
	{ id: "demo", title: "Demo day", start: atHour(12, 15), end: atHour(12, 16), color: "yellow" },
];

type Setting = "monday" | "business" | "weekends";
type ZoneChoice = "local" | "America/New_York" | "Europe/London" | "Asia/Tokyo" | "Asia/Kolkata";
type MenuValue = Setting | `zone:${ZoneChoice}`;

const SETTINGS: readonly { readonly value: Setting; readonly label: string }[] = [
	{ value: "monday", label: "Week starts Monday" },
	{ value: "business", label: "Business hours only" },
	{ value: "weekends", label: "Shade weekends" },
];
const ZONES: readonly { readonly value: ZoneChoice; readonly label: string }[] = [
	{ value: "local", label: "This device" },
	{ value: "America/New_York", label: "New York" },
	{ value: "Europe/London", label: "London" },
	{ value: "Asia/Tokyo", label: "Tokyo" },
	{ value: "Asia/Kolkata", label: "Kolkata" },
];

const MONDAY: EventCalendarWeekStartsOn = 1;
const SUNDAY: EventCalendarWeekStartsOn = 0;
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 19;
const WHOLE_DAY_START = 0;
const WHOLE_DAY_END = 24;

// Every view behind the view menu, and a settings menu that changes the week, the hours, shading and the zone.
export function EventCalendar1Example(): React.JSX.Element {
	const [view, setView] = React.useState<CalendarView>("month");
	const [settings, setSettings] = React.useState<ReadonlySet<Setting>>(() => new Set<Setting>(["weekends", "business"]));
	const [zone, setZone] = React.useState<ZoneChoice>("local");
	const items = React.useMemo(
		(): DropdownMenuItemData<MenuValue>[] => [
			...SETTINGS.map((entry): DropdownMenuItemData<MenuValue> => ({
				value: entry.value,
				label: entry.label,
				kind: "checkbox",
				checked: settings.has(entry.value),
				group: "Display",
			})),
			...ZONES.map((entry): DropdownMenuItemData<MenuValue> => ({
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
		const picked = ZONES.find((entry): boolean => `zone:${entry.value}` === value);
		if (picked !== undefined) {
			setZone(picked.value);
			return;
		}
		const setting = SETTINGS.find((entry): boolean => entry.value === value)?.value;
		setSettings((current): ReadonlySet<Setting> => {
			const next = new Set(current);
			if (setting !== undefined && !next.delete(setting)) {
				next.add(setting);
			}
			return next;
		});
	}, []);
	const business = settings.has("business");
	const menu = <DropdownMenu label="Settings" title="Settings" items={items} onSelect={choose} icon={Settings2Icon} size="sm" />;
	return (
		<EventCalendar
			events={EVENTS}
			view={view}
			onViewChange={setView}
			clock={SAMPLE_CLOCK}
			timeZone={zone === "local" ? undefined : zone}
			weekStartsOn={settings.has("monday") ? MONDAY : SUNDAY}
			offDays={settings.has("weekends")}
			dayStartHour={business ? BUSINESS_START_HOUR : WHOLE_DAY_START}
			dayEndHour={business ? BUSINESS_END_HOUR : WHOLE_DAY_END}
			toolbarContent={menu}
		/>
	);
}
