"use client";

import { PlusIcon, Settings2Icon } from "lucide-react";
import * as React from "react";
import { EventCalendar, type EventCalendarRenderEventProps } from "@workspace/ui/components/event-calendar/event-calendar";
import { EventCalendarContent } from "@workspace/ui/components/event-calendar/event-calendar-content";
import type { EventCalendarI18nOverrides } from "@workspace/ui/components/event-calendar/event-calendar-i18n";
import { EventCalendarNav, EventCalendarToolbar } from "@workspace/ui/components/event-calendar/event-calendar-nav";
import type {
	CalendarEvent,
	CalendarView,
	EventCalendarInteractions,
	EventCalendarResource,
	EventCalendarViewSettings,
	WeekStartsOn,
} from "@workspace/ui/components/event-calendar/event-calendar-types";
import { addDays, addMinutes, setHours, startOfDay, startOfWeek, type Locale } from "date-fns";
import { ar, de, enUS, es, fr, ja } from "date-fns/locale";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Label } from "@workspace/ui/components/label";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { Switch } from "@workspace/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so every view always opens on the same week. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const SUNDAY: WeekStartsOn = 0;
const MONDAY: WeekStartsOn = 1;
/** "New event" drops a one-hour event at noon on the sample day. */
const NEW_EVENT_HOUR = 12;
const NEW_EVENT_MINUTES = 60;
const POPOVER_OFFSET_PX = 8;
/** The "days" view opens on three days, the calendar's own default. */
const DEFAULT_DAY_COUNT = 3;

/** Team members - passing resources unlocks the resource day view, so the view switcher offers every view the calendar ships. */
const TEAM: readonly EventCalendarResource[] = [
	{ id: "alex", title: "Alex", color: "blue" },
	{ id: "mia", title: "Mia", color: "violet" },
	{ id: "sam", title: "Sam", color: "green" },
];

function atTime(week: Date, dayOffset: number, hour: number, minute: number): Date {
	return addMinutes(setHours(addDays(week, dayOffset), hour), minute);
}

/** Demo events: a balanced sample week (timed, multi-day, all-day, two custom-rendered chips) plus a light scatter in the nearby weeks. */
function buildEvents(anchor: Date): readonly CalendarEvent[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: SUNDAY });
	return [
		{ id: "team-sync", title: "Team sync", start: atTime(week, 1, 9, 0), end: atTime(week, 1, 9, 30), resourceId: "alex" },
		{ id: "design-review", title: "Design review", start: atTime(week, 2, 11, 0), end: atTime(week, 2, 12, 0), resourceId: "mia", color: "violet" },
		{ id: "product-demo", title: "Product demo", start: atTime(week, 3, 15, 0), end: atTime(week, 3, 16, 0), resourceId: "sam", color: "green" },
		{ id: "roadmap-planning", title: "Roadmap planning", start: atTime(week, 4, 10, 0), end: atTime(week, 4, 11, 30), resourceId: "alex", color: "teal" },
		{ id: "client-call", title: "Client call", start: atTime(week, 5, 14, 0), end: atTime(week, 5, 15, 0), resourceId: "mia", color: "yellow" },
		{ id: "team-offsite", title: "Team offsite", start: addDays(week, 4), end: addDays(week, 6), allDay: true, color: "red" },
		{ id: "sprint-planning", title: "Sprint planning", start: atTime(week, 9, 9, 30), end: atTime(week, 9, 10, 30), resourceId: "sam", color: "blue" },
		{ id: "quarterly-review", title: "Quarterly review", start: atTime(week, 17, 13, 0), end: atTime(week, 17, 14, 30), resourceId: "alex", color: "orange" },
	];
}

const INITIAL_EVENTS: readonly CalendarEvent[] = buildEvents(SAMPLE_NOW);

/**
 * Custom chip content for a couple of events - proof that the chip is fully yours to shape via `renderEvent`.
 * Returning null for everything else falls back to the built-in dot + title + time.
 */
function renderEventContent({ occurrence }: EventCalendarRenderEventProps): React.ReactNode {
	const { event } = occurrence;

	// Attendee avatars in place of the leading colour dot; a thin ring-1 keeps the overlap crisp at this size.
	if (event.id === "design-review") {
		return (
			<>
				<span className="flex shrink-0 -space-x-1">
					<Avatar className="size-4 ring-1 ring-background">
						<AvatarFallback className="bg-tone-violet-soft text-xs font-semibold text-tone-violet">MJ</AvatarFallback>
					</Avatar>
					<Avatar className="size-4 ring-1 ring-background">
						<AvatarFallback className="bg-tone-blue-soft text-xs font-semibold text-tone-blue">AL</AvatarFallback>
					</Avatar>
				</span>
				<span className="truncate font-medium">{event.title}</span>
			</>
		);
	}

	// Title with a trailing status pill. The dot, title and pill share one flex row so the leading dot stays glued to the label.
	if (event.id === "client-call") {
		return (
			<span className="flex w-full min-w-0 items-center gap-1.5">
				<span aria-hidden className="-me-0.5 size-1.5 shrink-0 rounded-full bg-(--ec-event-color)" />
				<span className="truncate font-medium">{event.title}</span>
				<span className="ms-auto shrink-0 rounded bg-(--ec-event-color)/25 px-1 text-xs font-semibold">30m</span>
			</span>
		);
	}

	return null;
}

/**
 * i18n presets - each language ships a date-fns `locale` (localizes every formatted date: weekday headers, month title, time gutter)
 * plus an `i18n` override map for the static UI strings the locale can't reach (Today, view names, "+N more").
 * Arabic also flips the whole calendar to right-to-left. English is the built-in copy, so it overrides nothing.
 */
interface DemoLocale {
	readonly id: string;
	/** Native language name, shown in the picker. */
	readonly label: string;
	readonly locale: Locale;
	readonly dir: "ltr" | "rtl";
	readonly i18n: EventCalendarI18nOverrides;
}

const ENGLISH: DemoLocale = { id: "en", label: "English", locale: enUS, dir: "ltr", i18n: {} };

const LOCALES: readonly DemoLocale[] = [
	ENGLISH,
	{
		id: "de",
		label: "Deutsch",
		locale: de,
		dir: "ltr",
		i18n: {
			labels: {
				today: "Heute",
				allDay: "Ganztägig",
				noEvents: "Keine Termine",
				more: (count: number): string => `+${String(count)} weitere`,
			},
			viewNames: {
				month: "Monat",
				week: "Woche",
				day: "Tag",
				days: (count: number): string => `${String(count)} Tage`,
				agenda: "Agenda",
				resource: "Zeitraster",
			},
		},
	},
	{
		id: "fr",
		label: "Français",
		locale: fr,
		dir: "ltr",
		i18n: {
			labels: {
				today: "Aujourd'hui",
				allDay: "Journée entière",
				noEvents: "Aucun événement",
				more: (count: number): string => `+${String(count)} autres`,
			},
			viewNames: {
				month: "Mois",
				week: "Semaine",
				day: "Jour",
				days: (count: number): string => `${String(count)} jours`,
				agenda: "Agenda",
				resource: "Grille horaire",
			},
		},
	},
	{
		id: "es",
		label: "Español",
		locale: es,
		dir: "ltr",
		i18n: {
			labels: {
				today: "Hoy",
				allDay: "Todo el día",
				noEvents: "Sin eventos",
				more: (count: number): string => `+${String(count)} más`,
			},
			viewNames: {
				month: "Mes",
				week: "Semana",
				day: "Día",
				days: (count: number): string => `${String(count)} días`,
				agenda: "Agenda",
				resource: "Cuadrícula",
			},
		},
	},
	{
		id: "ja",
		label: "日本語",
		locale: ja,
		dir: "ltr",
		i18n: {
			labels: {
				today: "今日",
				allDay: "終日",
				noEvents: "予定なし",
				more: (count: number): string => `他${String(count)}件`,
			},
			viewNames: {
				month: "月",
				week: "週",
				day: "日",
				days: (count: number): string => `${String(count)}日間`,
				agenda: "予定",
				resource: "タイムグリッド",
			},
		},
	},
	{
		id: "ar",
		label: "العربية",
		locale: ar,
		dir: "rtl",
		i18n: {
			labels: {
				today: "اليوم",
				allDay: "طوال اليوم",
				noEvents: "لا توجد أحداث",
				more: (count: number): string => `+${String(count)} المزيد`,
			},
			viewNames: {
				month: "شهر",
				week: "أسبوع",
				day: "يوم",
				days: (count: number): string => `${String(count)} أيام`,
				agenda: "جدول الأعمال",
				resource: "شبكة زمنية",
			},
		},
	},
];

interface DemoTimeZone {
	readonly id: string;
	readonly label: string;
	readonly value: string;
}

/** The zone the browser runs in - the calendar's own default display zone. */
const BROWSER_TIME_ZONE: DemoTimeZone = { id: "local", label: "Browser", value: Intl.DateTimeFormat().resolvedOptions().timeZone };

/** Display time zones - all event math and rendering happen in the chosen zone, so switching it visibly shifts every event's clock time. */
const TIME_ZONES: readonly DemoTimeZone[] = [
	BROWSER_TIME_ZONE,
	{ id: "ny", label: "New York", value: "America/New_York" },
	{ id: "london", label: "London", value: "Europe/London" },
	{ id: "tokyo", label: "Tokyo", value: "Asia/Tokyo" },
	{ id: "kolkata", label: "Kolkata", value: "Asia/Kolkata" },
];

const LOCALE_OPTIONS: readonly SelectOption<string>[] = LOCALES.map((entry: DemoLocale): SelectOption<string> => ({ value: entry.id, label: entry.label }));
const TIME_ZONE_OPTIONS: readonly SelectOption<string>[] = TIME_ZONES.map((entry: DemoTimeZone): SelectOption<string> => ({ value: entry.id, label: entry.label }));

const WEEK_START_OPTIONS: readonly SelectOption<WeekStartsOn>[] = [
	{ value: SUNDAY, label: "Sunday" },
	{ value: MONDAY, label: "Monday" },
];
const DAY_START_OPTIONS: readonly SelectOption<number>[] = [
	{ value: 0, label: "00:00" },
	{ value: 6, label: "06:00" },
	{ value: 8, label: "08:00" },
];
const DAY_END_OPTIONS: readonly SelectOption<number>[] = [
	{ value: 18, label: "18:00" },
	{ value: 20, label: "20:00" },
	{ value: 24, label: "24:00" },
];
const INTERVAL_OPTIONS: readonly SelectOption<number>[] = [
	{ value: 30, label: "30 min" },
	{ value: 60, label: "60 min" },
];
const SNAP_OPTIONS: readonly SelectOption<number>[] = [
	{ value: 5, label: "5 min" },
	{ value: 15, label: "15 min" },
	{ value: 30, label: "30 min" },
];

type ViewSettingKey = keyof EventCalendarViewSettings;
type InteractionKey = keyof EventCalendarInteractions;
type NumericSettingKey = "dayStartHour" | "dayEndHour" | "interval" | "snapDuration";
type TextSettingKey = "localeId" | "timeZoneId";

/** Everything the settings panel drives, as one resettable object. */
interface DemoSettings {
	readonly viewSettings: EventCalendarViewSettings;
	readonly interactions: EventCalendarInteractions;
	readonly weekStartsOn: WeekStartsOn;
	readonly dayStartHour: number;
	readonly dayEndHour: number;
	readonly interval: number;
	readonly snapDuration: number;
	readonly showDayAddButton: boolean;
	readonly localeId: string;
	readonly timeZoneId: string;
}

const DEFAULT_SETTINGS: DemoSettings = {
	viewSettings: { weekends: true, weekNumbers: false, nowIndicator: true, offDays: false },
	interactions: { drag: true, resize: true, selectSlot: true },
	weekStartsOn: SUNDAY,
	dayStartHour: 0,
	dayEndHour: 24,
	interval: 60,
	snapDuration: 15,
	showDayAddButton: false,
	localeId: ENGLISH.id,
	timeZoneId: BROWSER_TIME_ZONE.id,
};

const SETTINGS_TRIGGER: React.JSX.Element = <Button variant="outline" size="sm" />;

interface SettingsSwitchProps<Name extends string> {
	readonly id: string;
	readonly label: string;
	readonly name: Name;
	readonly checked: boolean;
	readonly onToggle: (name: Name, checked: boolean) => void;
}

function SettingsSwitch<Name extends string>({ id, label, name, checked, onToggle }: SettingsSwitchProps<Name>): React.JSX.Element {
	const handleChange = React.useCallback(
		(next: boolean): void => {
			onToggle(name, next);
		},
		[name, onToggle],
	);
	return (
		<div className="flex items-center justify-between gap-4">
			<Label htmlFor={id} className="font-normal">
				{label}
			</Label>
			<Switch id={id} checked={checked} onCheckedChange={handleChange} />
		</div>
	);
}

interface SettingsSelectProps<Name extends string, Value> {
	readonly id: string;
	readonly label: string;
	readonly name: Name;
	readonly value: Value;
	readonly options: readonly SelectOption<Value>[];
	readonly onSelect: (name: Name, value: Value) => void;
	readonly wide?: boolean;
}

/** A labelled settings picker; the trigger shows the selected option's label through the select's `items`. */
function SettingsSelect<Name extends string, Value>({ id, label, name, value, options, onSelect, wide = false }: SettingsSelectProps<Name, Value>): React.JSX.Element {
	const handleChange = React.useCallback(
		(next: Value | null): void => {
			if (next !== null) {
				onSelect(name, next);
			}
		},
		[name, onSelect],
	);
	return (
		<div className="flex items-center justify-between gap-4">
			<Label htmlFor={id} className="font-normal">
				{label}
			</Label>
			<Select<Value> items={options} value={value} onValueChange={handleChange}>
				<SelectTrigger id={id} size="sm" className={wide ? "w-36" : "w-28"}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option: SelectOption<Value>): React.JSX.Element => (
						<SelectItem key={option.label} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

export function EventCalendar1Example(): React.JSX.Element {
	const [events, setEvents] = React.useState<readonly CalendarEvent[]>(INITIAL_EVENTS);
	const [date, setDate] = React.useState<Date>(SAMPLE_NOW);
	const [dayCount, setDayCount] = React.useState<number>(DEFAULT_DAY_COUNT);
	const newEventCount = React.useRef(0);
	const [settings, setSettings] = React.useState<DemoSettings>(DEFAULT_SETTINGS);
	// The settings panel shows the time-grid internals tab only where those options are visible
	// (week/day/N-days and the resource time grid - month and agenda render no hour track).
	const [view, setView] = React.useState<CalendarView>("month");
	const isTimeGridView = view !== "month" && view !== "agenda";

	const activeLocale = LOCALES.find((entry: DemoLocale): boolean => entry.id === settings.localeId) ?? ENGLISH;
	const activeTimeZone = TIME_ZONES.find((entry: DemoTimeZone): boolean => entry.id === settings.timeZoneId) ?? BROWSER_TIME_ZONE;

	const handleViewSettings = React.useCallback((viewSettings: EventCalendarViewSettings): void => {
		setSettings((current: DemoSettings): DemoSettings => ({ ...current, viewSettings }));
	}, []);
	const handleInteractions = React.useCallback((interactions: EventCalendarInteractions): void => {
		setSettings((current: DemoSettings): DemoSettings => ({ ...current, interactions }));
	}, []);
	const toggleViewSetting = React.useCallback((name: ViewSettingKey, checked: boolean): void => {
		setSettings((current: DemoSettings): DemoSettings => ({ ...current, viewSettings: { ...current.viewSettings, [name]: checked } }));
	}, []);
	const toggleInteraction = React.useCallback((name: InteractionKey, checked: boolean): void => {
		setSettings((current: DemoSettings): DemoSettings => ({ ...current, interactions: { ...current.interactions, [name]: checked } }));
	}, []);
	const toggleDayAddButton = React.useCallback((_name: "showDayAddButton", checked: boolean): void => {
		setSettings((current: DemoSettings): DemoSettings => ({ ...current, showDayAddButton: checked }));
	}, []);
	const selectWeekStart = React.useCallback((_name: "weekStartsOn", weekStartsOn: WeekStartsOn): void => {
		setSettings((current: DemoSettings): DemoSettings => ({ ...current, weekStartsOn }));
	}, []);
	const selectNumber = React.useCallback((name: NumericSettingKey, value: number): void => {
		setSettings((current: DemoSettings): DemoSettings => ({ ...current, [name]: value }));
	}, []);
	const selectText = React.useCallback((name: TextSettingKey, value: string): void => {
		setSettings((current: DemoSettings): DemoSettings => ({ ...current, [name]: value }));
	}, []);
	const resetSettings = React.useCallback((): void => {
		setSettings(DEFAULT_SETTINGS);
	}, []);

	// Add a one-hour event at noon on the sample day and jump to it - a minimal stand-in for a real "create event" dialog.
	const addEvent = React.useCallback((): void => {
		const start = setHours(startOfDay(SAMPLE_NOW), NEW_EVENT_HOUR);
		newEventCount.current += 1;
		const created: CalendarEvent = {
			id: `new-event-${String(newEventCount.current)}`,
			title: "New event",
			start,
			end: addMinutes(start, NEW_EVENT_MINUTES),
			resourceId: "alex",
			color: "blue",
		};
		setEvents((current: readonly CalendarEvent[]): readonly CalendarEvent[] => [...current, created]);
		setDate(start);
	}, []);

	return (
		<div className="w-full p-4" dir={activeLocale.dir}>
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<EventCalendar
						events={events}
						onEventsChange={setEvents}
						view={view}
						onViewChange={setView}
						date={date}
						onDateChange={setDate}
						dayCount={dayCount}
						onDayCountChange={setDayCount}
						now={SAMPLE_NOW}
						resources={TEAM}
						renderEvent={renderEventContent}
						locale={activeLocale.locale}
						i18n={activeLocale.i18n}
						timeZone={activeTimeZone.value}
						viewSettings={settings.viewSettings}
						onViewSettingsChange={handleViewSettings}
						interactions={settings.interactions}
						onInteractionsChange={handleInteractions}
						weekStartsOn={settings.weekStartsOn}
						dayStartHour={settings.dayStartHour}
						dayEndHour={settings.dayEndHour}
						interval={settings.interval}
						snapDuration={settings.snapDuration}
						showDayAddButton={settings.showDayAddButton}
						offDays
						className="h-160 w-full">
						<div className="flex flex-wrap items-center gap-2 pe-2">
							<EventCalendarNav className="min-w-0 flex-1" />
							<EventCalendarToolbar>
								<Popover>
									<PopoverTrigger render={SETTINGS_TRIGGER}>
										<Settings2Icon className="size-4" aria-hidden="true" />
										Settings
									</PopoverTrigger>
									<PopoverContent align="end" sideOffset={POPOVER_OFFSET_PX} className="w-80">
										<Tabs defaultValue="view">
											<TabsList className="w-full">
												<TabsTrigger value="view" className="flex-1">
													View
												</TabsTrigger>
												{/* time-grid internals only exist where an hour track renders, so the tab follows the active view */}
												{isTimeGridView ? (
													<TabsTrigger value="time" className="flex-1">
														Time grid
													</TabsTrigger>
												) : null}
												<TabsTrigger value="behavior" className="flex-1">
													Behavior
												</TabsTrigger>
												<TabsTrigger value="region" className="flex-1">
													Region
												</TabsTrigger>
											</TabsList>
											<TabsContent value="view" className="flex flex-col gap-3">
												<SettingsSwitch<ViewSettingKey>
													id="ec-set-weekends"
													label="Weekends"
													name="weekends"
													checked={settings.viewSettings.weekends ?? true}
													onToggle={toggleViewSetting}
												/>
												<SettingsSwitch<ViewSettingKey>
													id="ec-set-week-numbers"
													label="Week numbers"
													name="weekNumbers"
													checked={settings.viewSettings.weekNumbers ?? false}
													onToggle={toggleViewSetting}
												/>
												<SettingsSwitch<ViewSettingKey>
													id="ec-set-now"
													label="Now indicator"
													name="nowIndicator"
													checked={settings.viewSettings.nowIndicator ?? true}
													onToggle={toggleViewSetting}
												/>
												<SettingsSwitch<ViewSettingKey>
													id="ec-set-off-days"
													label="Mark off days"
													name="offDays"
													checked={settings.viewSettings.offDays ?? false}
													onToggle={toggleViewSetting}
												/>
												<SettingsSwitch id="ec-set-day-add" label="Day add button" name="showDayAddButton" checked={settings.showDayAddButton} onToggle={toggleDayAddButton} />
												{/* week start shapes month and week grids alike, so it lives here rather than in time-grid internals */}
												<SettingsSelect
													id="ec-set-week-start"
													label="Week starts"
													name="weekStartsOn"
													value={settings.weekStartsOn}
													options={WEEK_START_OPTIONS}
													onSelect={selectWeekStart}
												/>
											</TabsContent>
											<TabsContent value="time" className="flex flex-col gap-3">
												<SettingsSelect<NumericSettingKey, number>
													id="ec-set-day-start"
													label="Day starts"
													name="dayStartHour"
													value={settings.dayStartHour}
													options={DAY_START_OPTIONS}
													onSelect={selectNumber}
												/>
												<SettingsSelect<NumericSettingKey, number>
													id="ec-set-day-end"
													label="Day ends"
													name="dayEndHour"
													value={settings.dayEndHour}
													options={DAY_END_OPTIONS}
													onSelect={selectNumber}
												/>
												<SettingsSelect<NumericSettingKey, number>
													id="ec-set-interval"
													label="Grid interval"
													name="interval"
													value={settings.interval}
													options={INTERVAL_OPTIONS}
													onSelect={selectNumber}
												/>
												<SettingsSelect<NumericSettingKey, number>
													id="ec-set-snap"
													label="Drag snap"
													name="snapDuration"
													value={settings.snapDuration}
													options={SNAP_OPTIONS}
													onSelect={selectNumber}
												/>
											</TabsContent>
											<TabsContent value="behavior" className="flex flex-col gap-3">
												<SettingsSwitch<InteractionKey> id="ec-set-drag" label="Drag to move" name="drag" checked={settings.interactions.drag} onToggle={toggleInteraction} />
												<SettingsSwitch<InteractionKey>
													id="ec-set-resize"
													label="Drag to resize"
													name="resize"
													checked={settings.interactions.resize}
													onToggle={toggleInteraction}
												/>
												<SettingsSwitch<InteractionKey>
													id="ec-set-select-slot"
													label="Drag to create"
													name="selectSlot"
													checked={settings.interactions.selectSlot}
													onToggle={toggleInteraction}
												/>
											</TabsContent>
											<TabsContent value="region" className="flex flex-col gap-3">
												<SettingsSelect<TextSettingKey, string>
													id="ec-set-language"
													label="Language"
													name="localeId"
													value={settings.localeId}
													options={LOCALE_OPTIONS}
													onSelect={selectText}
													wide
												/>
												<SettingsSelect<TextSettingKey, string>
													id="ec-set-timezone"
													label="Time zone"
													name="timeZoneId"
													value={settings.timeZoneId}
													options={TIME_ZONE_OPTIONS}
													onSelect={selectText}
													wide
												/>
												<p className="text-xs leading-relaxed text-muted-foreground">
													Language switches the date-fns locale and every UI label. Time zone shifts all event times. Arabic also flips the calendar to right-to-left.
												</p>
											</TabsContent>
										</Tabs>
										<Button variant="outline" size="sm" className="mt-4 w-full" onClick={resetSettings}>
											Reset to defaults
										</Button>
									</PopoverContent>
								</Popover>
								<Button size="sm" onClick={addEvent}>
									<PlusIcon className="size-4" aria-hidden="true" />
									New event
								</Button>
							</EventCalendarToolbar>
						</div>
						<EventCalendarContent />
					</EventCalendar>
				</CardContent>
			</Card>
		</div>
	);
}
