// An event calendar for a phone: a month of days (tap one to list its events below it), a week or a day on a time
// grid, events per resource side by side (rooms, people), and an agenda. The web kit's `EventCalendar` for a
// phone: the rules are the same ones — view ranges, occurrences and recurrence, packing overlapping events into
// columns — shared in @workspace/ui-kit-logic `event-calendar`, so both kits lay a calendar out identically.
//
// A tap on an event reports it (`onEventPress`); a tap on free time reports the slot (`onSlotPress`), and a drag
// down free time on the time grid books a slot (`onSelectSlot`), refused while `canSelectSlot` says no (an
// overlap). Every event is a button that reads its title and time; every day of the month is a button that says
// how many events it holds.

import {
	addZonedDays,
	chunkWeeks,
	eventCalendarBuildEventIndex,
	eventCalendarGetDayKey,
	eventCalendarResolveOffDay,
	eventCalendarToZoned,
	getViewDateRange,
	getVisibleDays,
	leafResources,
	mergeEventCalendarI18n,
	minutesToInstant,
	stepDate,
	type CalendarEvent,
	type CalendarView,
	type EventCalendarI18nOverrides,
	type EventCalendarOccurrence,
	type EventCalendarOffDaysConfig,
	type EventCalendarResource,
	type EventCalendarSegment,
	type EventCalendarSlotDraft,
	type EventCalendarWeekStartsOn,
} from "@workspace/ui-kit-logic";
import { cva } from "class-variance-authority";
import { format, isSameMonth } from "date-fns";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import * as React from "react";
import { type LayoutChangeEvent, PanResponder, Pressable, ScrollView, Text, View, type ViewInstance, type ViewStyle } from "react-native";

import { cn } from "../lib/cn";
import {
	DEFAULT_EVENT_CALENDAR_LABELS,
	dragSlotMinutes,
	type EventCalendarClock,
	eventToneClass,
	minuteToY,
	PHONE_CALENDAR_VIEWS,
	timeGridHours,
	type TimeGridGeometry,
} from "../lib/event-calendar";
import { Button } from "./button";
import { DropdownMenu, type DropdownMenuItemData } from "./dropdown-menu";
import { IconButton } from "./icon-button";

/** How many event chips a month day shows before "+n". */
const MONTH_CHIPS = 2;
/** An hour of the time grid, in points. */
const HOUR_HEIGHT = 48;
/** How far a press must travel before it is a drag, in points. */
const DRAG_SLOP = 6;
/** A resource column's width, in points (`w-36`). */
const RESOURCE_COLUMN_WIDTH = 144;
const MINUTES_PER_HOUR = 60;
const DEFAULT_START_HOUR = 0;
const DEFAULT_END_HOUR = 24;
const DEFAULT_SLOT_MINUTES = 30;
const AGENDA_DAYS = 14;
const SINGLE_DAY = 1;
const NO_EVENTS: readonly CalendarEvent[] = [];
const NO_RESOURCES: readonly EventCalendarResource[] = [];
const SYSTEM_CLOCK: EventCalendarClock = { nowEpochMs: (): number => Date.now() };

export const eventCalendarVariants = cva("w-full gap-3");

export const eventCalendarDayVariants = cva("active:bg-surface-selected min-h-16 flex-1 gap-0.5 border-t border-l border-border p-1", {
	variants: {
		outside: { true: "opacity-50", false: "" },
		selected: { true: "bg-surface-selected", false: "" },
		off: { true: "bg-muted/40", false: "" },
	},
	defaultVariants: { outside: false, selected: false, off: false },
});

export const eventCalendarEventVariants = cva("overflow-hidden rounded-md px-1.5 py-0.5 active:opacity-80");

function defaultTimeZone(): string {
	return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** What draws an event: the calendar's chip, or the caller's (`renderEvent`). */
export type EventCalendarRenderContext = "month" | "time" | "agenda";

export interface EventCalendarProps {
	/** The events (expanded by their recurrence). */
	readonly events?: readonly CalendarEvent[] | undefined;
	/** Columns of the resource view (rooms, people); events attach by `resourceId`. */
	readonly resources?: readonly EventCalendarResource[] | undefined;
	readonly view?: CalendarView | undefined;
	readonly defaultView?: CalendarView | undefined;
	readonly onViewChange?: ((view: CalendarView) => void) | undefined;
	/** The views the menu offers. */
	readonly views?: readonly CalendarView[] | undefined;
	readonly date?: Date | undefined;
	readonly defaultDate?: Date | undefined;
	readonly onDateChange?: ((date: Date) => void) | undefined;
	readonly clock?: EventCalendarClock | undefined;
	/** The zone dates are shown in. Default the device's. */
	readonly timeZone?: string | undefined;
	readonly weekStartsOn?: EventCalendarWeekStartsOn | undefined;
	/** Shaded days (weekends by default). */
	readonly offDays?: boolean | EventCalendarOffDaysConfig | undefined;
	/** The time grid's first and last hour. Default the whole day. */
	readonly dayStartHour?: number | undefined;
	readonly dayEndHour?: number | undefined;
	/** The minutes a tap or a drag snaps to. Default 30. */
	readonly slotMinutes?: number | undefined;
	readonly onEventPress?: ((occurrence: EventCalendarOccurrence) => void) | undefined;
	/** A tap on free time (a month day, or a slot of the time grid). */
	readonly onSlotPress?: ((slot: EventCalendarSlotDraft) => void) | undefined;
	/** A drag down free time on the time grid: book it. */
	readonly onSelectSlot?: ((slot: EventCalendarSlotDraft) => void) | undefined;
	/** Whether a drawn slot may be booked (false: it is refused, an overlap). */
	readonly canSelectSlot?: ((slot: EventCalendarSlotDraft) => boolean) | undefined;
	/** Draws an event in place of the calendar's chip. */
	readonly renderEvent?: ((occurrence: EventCalendarOccurrence, context: EventCalendarRenderContext) => React.ReactNode) | undefined;
	readonly showNav?: boolean | undefined;
	readonly toolbarContent?: React.ReactNode | undefined;
	readonly i18n?: EventCalendarI18nOverrides | undefined;
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

type Copy = ReturnType<typeof mergeEventCalendarI18n>;

/** An event's chip: its tone, its title (and time on the grid); a button that reports it. */
const EventChip = React.memo(function EventChip({
	occurrence,
	context,
	label,
	style,
	timeLabel,
	renderEvent,
	onPress,
}: {
	readonly occurrence: EventCalendarOccurrence;
	readonly context: EventCalendarRenderContext;
	readonly label: string;
	readonly style?: ViewStyle | undefined;
	readonly timeLabel?: string | undefined;
	readonly renderEvent: EventCalendarProps["renderEvent"];
	readonly onPress: ((occurrence: EventCalendarOccurrence) => void) | undefined;
}): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onPress?.(occurrence);
	}, [occurrence, onPress]);
	const custom = renderEvent?.(occurrence, context);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={handlePress}
			style={style}
			className={cn(context === "time" ? "absolute" : "", eventCalendarEventVariants(), custom === undefined ? eventToneClass(occurrence.event.color) : "")}>
			{custom ?? (
				<>
					<Text numberOfLines={1} className="text-overline font-sans-medium text-status-foreground">
						{occurrence.event.title}
					</Text>
					{timeLabel === undefined ? null : (
						<Text numberOfLines={1} className="text-overline font-sans text-status-foreground/80">
							{timeLabel}
						</Text>
					)}
				</>
			)}
		</Pressable>
	);
});

/** One day of the month grid: its number, a few chips and "+n"; a button that selects it. */
const MonthDay = React.memo(function MonthDay({
	day,
	dayKey,
	label,
	number,
	occurrences,
	outside,
	selected,
	off,
	isToday,
	copy,
	renderEvent,
	onSelect,
}: {
	readonly day: Date;
	readonly dayKey: string;
	readonly label: string;
	readonly number: string;
	readonly occurrences: readonly EventCalendarOccurrence[];
	readonly outside: boolean;
	readonly selected: boolean;
	readonly off: boolean;
	readonly isToday: boolean;
	readonly copy: Copy;
	readonly renderEvent: EventCalendarProps["renderEvent"];
	readonly onSelect: (day: Date, key: string) => void;
}): React.JSX.Element {
	const handlePress = React.useCallback((): void => {
		onSelect(day, dayKey);
	}, [day, dayKey, onSelect]);
	const state = React.useMemo(() => ({ selected }), [selected]);
	const shown = occurrences.slice(0, MONTH_CHIPS);
	const more = occurrences.length - shown.length;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${label}, ${copy.labels.events(occurrences.length)}`}
			accessibilityState={state}
			onPress={handlePress}
			className={eventCalendarDayVariants({ outside, selected, off })}>
			<Text className={cn("text-caption font-sans-medium", isToday ? "text-primary" : "text-foreground")}>{number}</Text>
			{shown.map((occurrence): React.JSX.Element => (
				<View
					key={occurrence.key}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					className={cn("rounded-sm px-0.5", renderEvent === undefined ? eventToneClass(occurrence.event.color) : "")}>
					{renderEvent?.(occurrence, "month") ?? (
						<Text numberOfLines={1} className="text-overline font-sans text-status-foreground">
							{occurrence.event.title}
						</Text>
					)}
				</View>
			))}
			{more > 0 ? <Text className="text-overline font-sans text-muted-foreground">{copy.labels.moreCompact(more)}</Text> : null}
		</Pressable>
	);
});

interface TimeColumnProps {
	readonly day: Date;
	readonly resourceId?: string | undefined;
	readonly segments: readonly EventCalendarSegment[];
	readonly geometry: TimeGridGeometry;
	readonly slotMinutes: number;
	readonly timeZone: string;
	readonly view: CalendarView;
	readonly copy: Copy;
	readonly renderEvent: EventCalendarProps["renderEvent"];
	readonly onEventPress: EventCalendarProps["onEventPress"];
	readonly onSlotPress: EventCalendarProps["onSlotPress"];
	readonly onSelectSlot: EventCalendarProps["onSelectSlot"];
	readonly canSelectSlot: EventCalendarProps["canSelectSlot"];
	readonly accessibilityLabel: string;
	readonly className?: string | undefined;
}

/** One day (or one resource's day) of the time grid: its events in their columns, and the free time around them. */
function TimeColumn({
	day,
	resourceId,
	segments,
	geometry,
	slotMinutes,
	timeZone,
	view,
	copy,
	renderEvent,
	onEventPress,
	onSlotPress,
	onSelectSlot,
	canSelectSlot,
	accessibilityLabel,
	className,
}: TimeColumnProps): React.JSX.Element {
	const [width, setWidth] = React.useState(0);
	const [draft, setDraft] = React.useState<{ readonly from: number; readonly to: number; readonly allowed: boolean } | null>(null);
	const handleLayout = React.useCallback((event: LayoutChangeEvent): void => {
		setWidth(event.nativeEvent.layout.width);
	}, []);
	const slotOf = React.useCallback(
		(fromY: number, toY: number): EventCalendarSlotDraft => {
			const { startMin, endMin } = dragSlotMinutes(fromY, toY, geometry, slotMinutes);
			const slot = { start: minutesToInstant(day, startMin, timeZone), end: minutesToInstant(day, endMin, timeZone), allDay: false, view };
			return resourceId === undefined ? slot : { ...slot, resourceId };
		},
		[day, geometry, resourceId, slotMinutes, timeZone, view],
	);
	const responder = React.useMemo(
		() =>
			PanResponder.create({
				onStartShouldSetPanResponder: (): boolean => true,
				onPanResponderTerminationRequest: (_, gesture): boolean => Math.abs(gesture.dy) <= DRAG_SLOP,
				onPanResponderGrant: (event): void => {
					const y = event.nativeEvent.locationY;
					setDraft({ from: y, to: y, allowed: true });
				},
				onPanResponderMove: (_, gesture): void => {
					if (Math.abs(gesture.dy) <= DRAG_SLOP) {
						return;
					}
					setDraft((current): { readonly from: number; readonly to: number; readonly allowed: boolean } | null => {
						if (current === null) {
							return current;
						}
						const to = current.from + gesture.dy;
						return { from: current.from, to, allowed: canSelectSlot?.(slotOf(current.from, to)) ?? true };
					});
				},
				onPanResponderRelease: (event, gesture): void => {
					const from = event.nativeEvent.locationY - gesture.dy;
					setDraft(null);
					if (Math.abs(gesture.dy) <= DRAG_SLOP) {
						onSlotPress?.(slotOf(from, from));
						return;
					}
					const slot = slotOf(from, from + gesture.dy);
					if (canSelectSlot?.(slot) ?? true) {
						onSelectSlot?.(slot);
					}
				},
				onPanResponderTerminate: (): void => {
					setDraft(null);
				},
			}),
		[canSelectSlot, onSelectSlot, onSlotPress, slotOf],
	);
	const height = (geometry.endHour - geometry.startHour) * geometry.hourHeight;
	const columnStyle = React.useMemo((): ViewStyle => ({ height }), [height]);
	const draftStyle = React.useMemo((): ViewStyle | null => {
		if (draft === null || Math.abs(draft.to - draft.from) <= DRAG_SLOP) {
			return null;
		}
		const { startMin, endMin } = dragSlotMinutes(draft.from, draft.to, geometry, slotMinutes);
		const top = minuteToY(startMin, geometry);
		return { top, height: minuteToY(endMin, geometry) - top, left: 0, right: 0 };
	}, [draft, geometry, slotMinutes]);
	return (
		<View
			{...responder.panHandlers}
			onLayout={handleLayout}
			accessible={false}
			accessibilityLabel={accessibilityLabel}
			style={columnStyle}
			className={cn("relative border-l border-border", className)}>
			{timeGridHours(geometry).map((hour): React.JSX.Element => (
				<View key={hour} style={hourLineStyle(hour, geometry)} className="absolute right-0 left-0 border-t border-border/60" />
			))}
			{segments.map((segment): React.JSX.Element => {
				const columns = Math.max(segment.columnCount ?? 1, 1);
				const span = segment.columnSpan ?? 1;
				const top = minuteToY(segment.startMin ?? 0, geometry);
				const bottom = minuteToY(segment.endMin ?? 0, geometry);
				const style: ViewStyle = {
					top,
					height: Math.max(bottom - top, MIN_EVENT_HEIGHT),
					left: ((segment.column ?? 0) / columns) * width,
					width: (span / columns) * width - EVENT_GAP,
				};
				const timeLabel = copy.functions.formatEventTime(
					eventCalendarToZoned(segment.occurrence.start, timeZone),
					eventCalendarToZoned(segment.occurrence.end, timeZone),
					segment.occurrence.allDay,
				);
				return (
					<EventChip
						key={`${segment.occurrence.key}-${String(segment.startMin ?? 0)}`}
						occurrence={segment.occurrence}
						context="time"
						label={copy.functions.formatEventAriaLabel(segment.occurrence.event.title, timeLabel, segment.continuesBefore || segment.continuesAfter)}
						style={style}
						timeLabel={timeLabel}
						renderEvent={renderEvent}
						onPress={onEventPress}
					/>
				);
			})}
			{draftStyle === null ? null : (
				<View
					pointerEvents="none"
					style={draftStyle}
					className={cn("absolute rounded-md border-2 border-dashed", draft?.allowed === false ? "border-destructive bg-destructive/10" : "border-primary bg-primary/10")}
				/>
			)}
		</View>
	);
}

/** The shortest an event is drawn, and the gap between side-by-side events, in points. */
const MIN_EVENT_HEIGHT = 18;
const EVENT_GAP = 2;

function hourLineStyle(hour: number, geometry: TimeGridGeometry): ViewStyle {
	return { top: (hour - geometry.startHour) * geometry.hourHeight };
}

/** The hours down the side of the time grid. */
function TimeGutter({
	geometry,
	timeZone,
	copy,
	day,
}: {
	readonly geometry: TimeGridGeometry;
	readonly timeZone: string;
	readonly copy: Copy;
	readonly day: Date;
}): React.JSX.Element {
	return (
		<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="w-12">
			{timeGridHours(geometry).map((hour): React.JSX.Element => (
				<View key={hour} style={GUTTER_ROW} className="items-end pr-1">
					<Text className="text-overline font-sans text-muted-foreground">
						{format(eventCalendarToZoned(minutesToInstant(day, hour * MINUTES_PER_HOUR, timeZone), timeZone), copy.formats.timeGutter)}
					</Text>
				</View>
			))}
		</View>
	);
}

const GUTTER_ROW: ViewStyle = { height: HOUR_HEIGHT };

export const EventCalendar = React.memo(
	React.forwardRef<ViewInstance, EventCalendarProps>(function EventCalendar(
		{
			events = NO_EVENTS,
			resources = NO_RESOURCES,
			view: controlledView,
			defaultView = "month",
			onViewChange,
			views = PHONE_CALENDAR_VIEWS,
			date: controlledDate,
			defaultDate,
			onDateChange,
			clock = SYSTEM_CLOCK,
			timeZone: timeZoneProp,
			weekStartsOn = 0,
			offDays = true,
			dayStartHour = DEFAULT_START_HOUR,
			dayEndHour = DEFAULT_END_HOUR,
			slotMinutes = DEFAULT_SLOT_MINUTES,
			onEventPress,
			onSlotPress,
			onSelectSlot,
			canSelectSlot,
			renderEvent,
			showNav = true,
			toolbarContent,
			i18n,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const copy = React.useMemo(() => mergeEventCalendarI18n(DEFAULT_EVENT_CALENDAR_LABELS, i18n), [i18n]);
		const timeZone = React.useMemo((): string => timeZoneProp ?? defaultTimeZone(), [timeZoneProp]);
		const nowMs = clock.nowEpochMs();
		const [ownView, setOwnView] = React.useState<CalendarView>(defaultView);
		const view = controlledView ?? ownView;
		const [ownDate, setOwnDate] = React.useState<Date>(() => defaultDate ?? new Date(nowMs));
		const date = controlledDate ?? ownDate;
		const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
		const geometry = React.useMemo((): TimeGridGeometry => ({ startHour: dayStartHour, endHour: dayEndHour, hourHeight: HOUR_HEIGHT }), [dayEndHour, dayStartHour]);
		const gridView = view === "resource" ? "day" : view;
		const ranges = React.useMemo(
			() => getViewDateRange(gridView, date, { timeZone, weekStartsOn, dayCount: SINGLE_DAY, agendaDayCount: AGENDA_DAYS, fixedWeeks: true }),
			[date, gridView, timeZone, weekStartsOn],
		);
		const index = React.useMemo(
			() => eventCalendarBuildEventIndex(events, ranges.visibleRange, { timeZone, weekStartsOn }),
			[events, ranges.visibleRange, timeZone, weekStartsOn],
		);
		const days = React.useMemo(() => getVisibleDays(ranges.visibleRange, timeZone), [ranges.visibleRange, timeZone]);
		const todayKey = eventCalendarGetDayKey(new Date(nowMs), timeZone);
		const occurrencesOn = React.useCallback(
			(key: string): readonly EventCalendarOccurrence[] => {
				const bucket = index.byDay.get(key);
				return bucket === undefined ? [] : [...bucket.allDay, ...bucket.timed].map((segment): EventCalendarOccurrence => segment.occurrence);
			},
			[index.byDay],
		);
		const setDate = React.useCallback(
			(next: Date): void => {
				setOwnDate(next);
				onDateChange?.(next);
			},
			[onDateChange],
		);
		const step = React.useCallback(
			(direction: 1 | -1): void => {
				setSelectedKey(null);
				setDate(stepDate(gridView, date, direction, { timeZone, dayCount: SINGLE_DAY, agendaDayCount: AGENDA_DAYS }));
			},
			[date, gridView, setDate, timeZone],
		);
		const goPrevious = React.useCallback((): void => {
			step(-1);
		}, [step]);
		const goNext = React.useCallback((): void => {
			step(1);
		}, [step]);
		const goToday = React.useCallback((): void => {
			setSelectedKey(null);
			setDate(new Date(clock.nowEpochMs()));
		}, [clock, setDate]);
		const viewItems = React.useMemo(
			(): DropdownMenuItemData<CalendarView>[] =>
				views.map((option): DropdownMenuItemData<CalendarView> => ({
					value: option,
					label: option === "days" ? copy.viewNames.days(SINGLE_DAY) : copy.viewNames[option],
					kind: "radio",
					checked: option === view,
				})),
			[copy.viewNames, view, views],
		);
		const chooseView = React.useCallback(
			(next: CalendarView): void => {
				setOwnView(next);
				onViewChange?.(next);
			},
			[onViewChange],
		);
		const selectDay = React.useCallback(
			(day: Date, key: string): void => {
				setSelectedKey((current): string | null => (current === key ? null : key));
				onSlotPress?.({ start: day, end: addZonedDays(day, 1, timeZone), allDay: true, view: "month" });
			},
			[onSlotPress, timeZone],
		);
		const title = copy.functions.formatTitle(gridView, {
			date: eventCalendarToZoned(date, timeZone),
			activeRange: { start: eventCalendarToZoned(ranges.activeRange.start, timeZone), end: eventCalendarToZoned(ranges.activeRange.end, timeZone) },
			visibleRange: ranges.visibleRange,
		});
		const viewName = view === "days" ? copy.viewNames.days(SINGLE_DAY) : copy.viewNames[view];
		const isOff = (day: Date): boolean => eventCalendarResolveOffDay(day, timeZone, offDays);
		const timeLabelOf = (occurrence: EventCalendarOccurrence): string =>
			copy.functions.formatEventTime(eventCalendarToZoned(occurrence.start, timeZone), eventCalendarToZoned(occurrence.end, timeZone), occurrence.allDay);
		const eventLabel = (occurrence: EventCalendarOccurrence): string => copy.functions.formatEventAriaLabel(occurrence.event.title, timeLabelOf(occurrence), false);

		let body: React.ReactNode;
		if (view === "month") {
			const weeks = chunkWeeks(days);
			const selectedOccurrences = selectedKey === null ? [] : occurrencesOn(selectedKey);
			const [firstWeek = []] = weeks;
			body = (
				<View className="gap-3">
					<View className="overflow-hidden rounded-lg border-r border-b border-border">
						<View className="flex-row">
							{firstWeek.map((day): React.JSX.Element => (
								<Text
									key={eventCalendarGetDayKey(day, timeZone)}
									accessibilityElementsHidden
									className="text-overline font-sans-medium flex-1 py-1 text-center text-muted-foreground">
									{format(eventCalendarToZoned(day, timeZone), copy.formats.monthDayHeader)}
								</Text>
							))}
						</View>
						{weeks.map((week): React.JSX.Element => (
							<View key={eventCalendarGetDayKey(week.at(0) ?? date, timeZone)} className="flex-row">
								{week.map((day): React.JSX.Element => {
									const key = eventCalendarGetDayKey(day, timeZone);
									const zoned = eventCalendarToZoned(day, timeZone);
									return (
										<MonthDay
											key={key}
											day={day}
											dayKey={key}
											label={format(zoned, copy.formats.monthCellAriaLabel)}
											number={format(zoned, copy.formats.monthCellDay)}
											occurrences={occurrencesOn(key)}
											outside={!isSameMonth(zoned, eventCalendarToZoned(date, timeZone))}
											selected={selectedKey === key}
											off={isOff(day)}
											isToday={key === todayKey}
											copy={copy}
											renderEvent={renderEvent}
											onSelect={selectDay}
										/>
									);
								})}
							</View>
						))}
					</View>
					{selectedKey === null ? null : (
						<View accessibilityLiveRegion="polite" className="gap-2">
							{selectedOccurrences.length === 0 ? <Text className="text-label font-sans text-muted-foreground">{copy.labels.noEvents}</Text> : null}
							{selectedOccurrences.map((occurrence): React.JSX.Element => (
								<EventChip
									key={occurrence.key}
									occurrence={occurrence}
									context="agenda"
									label={eventLabel(occurrence)}
									timeLabel={timeLabelOf(occurrence)}
									renderEvent={renderEvent}
									onPress={onEventPress}
								/>
							))}
						</View>
					)}
				</View>
			);
		} else if (view === "agenda") {
			const withEvents = days.filter((day): boolean => occurrencesOn(eventCalendarGetDayKey(day, timeZone)).length > 0);
			body = (
				<View className="gap-3">
					{withEvents.length === 0 ? <Text className="text-label font-sans text-muted-foreground">{copy.labels.noEvents}</Text> : null}
					{withEvents.map((day): React.JSX.Element => {
						const key = eventCalendarGetDayKey(day, timeZone);
						const zoned = eventCalendarToZoned(day, timeZone);
						return (
							<View key={key} className="gap-1.5">
								<Text accessibilityRole="header" className="text-caption font-sans-semibold text-foreground">
									{`${format(zoned, copy.formats.agendaWeekday)}, ${format(zoned, copy.formats.dayRange)}`}
								</Text>
								{occurrencesOn(key).map((occurrence): React.JSX.Element => (
									<EventChip
										key={occurrence.key}
										occurrence={occurrence}
										context="agenda"
										label={eventLabel(occurrence)}
										timeLabel={timeLabelOf(occurrence)}
										renderEvent={renderEvent}
										onPress={onEventPress}
									/>
								))}
							</View>
						);
					})}
				</View>
			);
		} else {
			// The time grid: a day per column (week, day), or a resource per column (resource view).
			const columns =
				view === "resource"
					? leafResources(resources).map((resource) => ({ key: resource.id, header: resource.title, day: days.at(0) ?? date, resourceId: resource.id }))
					: days.map((day) => ({
							key: eventCalendarGetDayKey(day, timeZone),
							header: format(eventCalendarToZoned(day, timeZone), copy.formats.timeGridDayHeader),
							day,
							resourceId: undefined,
						}));
			const scrollable = view === "resource";
			const grid = (
				<View>
					<View className="flex-row border-b border-border">
						{columns.map((column): React.JSX.Element => (
							<Text
								key={column.key}
								numberOfLines={1}
								style={scrollable ? RESOURCE_COLUMN : undefined}
								className={cn("text-overline font-sans-medium py-1 text-center text-foreground", scrollable ? "" : "flex-1")}>
								{column.header}
							</Text>
						))}
					</View>
					<View className="flex-row">
						{columns.map((column): React.JSX.Element => {
							const key = eventCalendarGetDayKey(column.day, timeZone);
							const segments = (index.byDay.get(key)?.timed ?? []).filter(
								(segment): boolean => column.resourceId === undefined || segment.occurrence.event.resourceId === column.resourceId,
							);
							return (
								<TimeColumn
									key={column.key}
									day={column.day}
									resourceId={column.resourceId}
									segments={segments}
									geometry={geometry}
									slotMinutes={slotMinutes}
									timeZone={timeZone}
									view={view}
									copy={copy}
									renderEvent={renderEvent}
									onEventPress={onEventPress}
									onSlotPress={onSlotPress}
									onSelectSlot={onSelectSlot}
									canSelectSlot={canSelectSlot}
									accessibilityLabel={column.header}
									className={cn(scrollable ? "w-36" : "flex-1", isOff(column.day) && !scrollable ? "bg-muted/40" : "")}
								/>
							);
						})}
					</View>
				</View>
			);
			body = (
				<View className="flex-row overflow-hidden rounded-lg border border-border">
					<View className="pt-6">
						<TimeGutter geometry={geometry} timeZone={timeZone} copy={copy} day={days.at(0) ?? date} />
					</View>
					{scrollable ? (
						<ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
							{grid}
						</ScrollView>
					) : (
						<View className="flex-1">{grid}</View>
					)}
				</View>
			);
		}

		return (
			<View ref={ref} testID={testID} className={cn(eventCalendarVariants(), className)}>
				{showNav ? (
					<View className="flex-row flex-wrap items-center gap-2">
						<IconButton icon={ChevronLeftIcon} label={copy.labels.previous} onPress={goPrevious} variant="secondary" size="sm" />
						<Button label={copy.labels.today} variant="outline" size="sm" onPress={goToday} />
						<IconButton icon={ChevronRightIcon} label={copy.labels.next} onPress={goNext} variant="secondary" size="sm" />
						<Text accessibilityRole="header" numberOfLines={1} className="text-label font-sans-semibold flex-1 text-foreground">
							{title}
						</Text>
						<DropdownMenu label={viewName} title={copy.labels.selectView} items={viewItems} onSelect={chooseView} size="sm" />
						{toolbarContent}
					</View>
				) : null}
				{body}
			</View>
		);
	}),
);

const RESOURCE_COLUMN: ViewStyle = { width: RESOURCE_COLUMN_WIDTH };
