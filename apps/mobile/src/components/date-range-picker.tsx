// A start and end date, picked on a month calendar in a bottom sheet: tap the
// first day, then the last (twice on one day for a single day); the days
// between are banded. The selected ends and the day count show above the
// calendar, and the caller's rule (a longest range, say) is checked before
// Apply is offered. Days outside `minDate`…`maxDate` cannot be picked, and
// the months beyond them are not offered. Each day is a button named by its
// full date and its place in the range.
//
// Presentational and controlled at the edges: the caller passes the range
// to start from and gets the new one from `onApply`; the draft in between is
// the sheet's own, and starts afresh each time it opens. Dates are calendar
// days (`YYYY-MM-DD`).

import { DAY_MS, inclusiveLocalDayCount, startOfLocalDateInTimeZone, UTC_TIME_ZONE, type LocalDate } from "@workspace/shared";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Modal, Pressable, Text, View } from "react-native";

import {
	addCalendarMonths,
	calendarMonthOf,
	compareCalendarMonths,
	firstDayOf,
	monthWeeks,
	pickRangeDay,
	rangeDayRoleOf,
	type CalendarMonth,
	type DateRangeDraft,
	type RangeDayRole,
} from "../lib/calendar";
import { playSelectionFeedback } from "../lib/haptics";
import { Button } from "./button";
import { Icon, type LucideIcon } from "./icon";
import { Subheading } from "./text";

export interface LocalDateRange {
	readonly from: LocalDate;
	readonly to: LocalDate;
}

export interface DateRangePickerProps {
	readonly visible: boolean;
	/** The sheet's heading ("Date range"). */
	readonly title: string;
	/** The range the sheet opens on, or none. */
	readonly initialRange: LocalDateRange | null;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	/** Marked on the calendar. */
	readonly today: LocalDate;
	/** The locale of the month and day names. */
	readonly locale: string;
	/** Why a complete range cannot be applied, or `null` when it can. */
	readonly validate: (range: LocalDateRange) => string | null;
	readonly onApply: (range: LocalDateRange) => void;
	readonly onClose: () => void;
	readonly testID?: string;
}

export function DateRangePicker({ visible, onClose, ...props }: DateRangePickerProps): React.JSX.Element {
	return (
		<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
			<View className="flex-1 justify-end">
				<Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} className="absolute inset-0 bg-scrim opacity-50" />
				{/* Mounted only while open, so every opening starts from `initialRange`. */}
				{visible ? <PickerSheet {...props} onClose={onClose} /> : null}
			</View>
		</Modal>
	);
}

type PickerSheetProps = Omit<DateRangePickerProps, "visible">;

/** Calendar dates are formatted at UTC midnight, so no zone moves them to another day. */
function dateMsOf(date: LocalDate): number {
	return startOfLocalDateInTimeZone(date, UTC_TIME_ZONE);
}

function PickerSheet({ title, initialRange, minDate, maxDate, today, locale, validate, onApply, onClose, testID }: PickerSheetProps): React.JSX.Element {
	const [draft, setDraft] = React.useState<DateRangeDraft>(initialRange ?? { from: null, to: null });
	const [month, setMonth] = React.useState<CalendarMonth>(calendarMonthOf(initialRange?.to ?? maxDate));
	const formats = React.useMemo(
		() => ({
			summary: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: UTC_TIME_ZONE }),
			full: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: UTC_TIME_ZONE }),
			month: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: UTC_TIME_ZONE }),
			weekday: new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: UTC_TIME_ZONE }),
		}),
		[locale],
	);

	const pick = React.useCallback((day: LocalDate): void => {
		playSelectionFeedback();
		setDraft((current: DateRangeDraft): DateRangeDraft => pickRangeDay(current, day));
	}, []);
	const showPrevious = React.useCallback((): void => {
		setMonth((current: CalendarMonth): CalendarMonth => addCalendarMonths(current, -1));
	}, []);
	const showNext = React.useCallback((): void => {
		setMonth((current: CalendarMonth): CalendarMonth => addCalendarMonths(current, 1));
	}, []);

	const complete = React.useMemo((): LocalDateRange | null => (draft.from !== null && draft.to !== null ? { from: draft.from, to: draft.to } : null), [draft]);
	/** The next tap sets the end (a start is picked, no end yet); otherwise it sets the start. */
	const pickingEnd = draft.from !== null && draft.to === null;
	const problem = complete === null ? null : validate(complete);
	const apply = React.useCallback((): void => {
		if (complete !== null && problem === null) {
			onApply(complete);
		}
	}, [complete, onApply, problem]);

	const canGoBack = compareCalendarMonths(month, calendarMonthOf(minDate)) > 0;
	const canGoOn = compareCalendarMonths(month, calendarMonthOf(maxDate)) < 0;
	const status = complete === null ? "Tap a start date, then an end date. Tap a date twice for a single day." : (problem ?? dayCountLabel(complete));

	return (
		<View accessibilityViewIsModal className="gap-4 rounded-t-2xl border border-border bg-popover px-4 pt-4 pb-8" testID={testID}>
			<View className="flex-row items-center justify-between">
				<Subheading>{title}</Subheading>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`Close ${title.toLowerCase()}`}
					onPress={onClose}
					hitSlop={8}
					className="size-11 items-center justify-center rounded-full active:opacity-60">
					<Icon icon={XIcon} size="md" colorClassName="accent-muted-foreground" />
				</Pressable>
			</View>
			<View className="flex-row gap-2">
				<RangeEnd label="Start" value={draft.from === null ? null : formats.summary.format(dateMsOf(draft.from))} active={!pickingEnd} />
				<RangeEnd label="End" value={draft.to === null ? null : formats.summary.format(dateMsOf(draft.to))} active={pickingEnd} />
			</View>
			<View className="gap-2">
				<View className="flex-row items-center justify-between">
					<MonthStep icon={ChevronLeftIcon} label="Previous month" enabled={canGoBack} onPress={showPrevious} />
					<Text accessibilityRole="header" className="font-sans-semibold text-base text-foreground">
						{formats.month.format(dateMsOf(firstDayOf(month)))}
					</Text>
					<MonthStep icon={ChevronRightIcon} label="Next month" enabled={canGoOn} onPress={showNext} />
				</View>
				<WeekdayHeader format={formats.weekday} />
				{monthWeeks(month).map((week: readonly (LocalDate | null)[]): React.JSX.Element => (
					<View key={week.find((day: LocalDate | null): boolean => day !== null) ?? ""} className="flex-row">
						{week.map((day: LocalDate | null, slot: number): React.JSX.Element =>
							day === null ? (
								<View key={`blank-${String(slot)}`} className="h-11 flex-1" />
							) : (
								<DayCell
									key={day}
									day={day}
									label={formats.full.format(dateMsOf(day))}
									role={rangeDayRoleOf(draft, day)}
									isToday={day === today}
									enabled={isWithin(day, minDate, maxDate)}
									onPick={pick}
								/>
							),
						)}
					</View>
				))}
			</View>
			<Text accessibilityLiveRegion="polite" className={`font-sans text-sm ${problem === null ? "text-muted-foreground" : "text-destructive-foreground"}`}>
				{status}
			</Text>
			<View className="flex-row justify-end gap-2">
				<Button label="Cancel" variant="ghost" onPress={onClose} />
				<Button label="Apply" onPress={apply} disabled={complete === null || problem !== null} {...(testID === undefined ? {} : { testID: `${testID}-apply` })} />
			</View>
		</View>
	);
}

/** `day` is from `first` to `last`, both included (`YYYY-MM-DD` strings sort as dates). */
function isWithin(day: LocalDate, first: LocalDate, last: LocalDate): boolean {
	return day >= first && day <= last;
}

/** "30 days", "1 day". */
function dayCountLabel(range: LocalDateRange): string {
	const days = inclusiveLocalDayCount(range.from, range.to);
	return days === 1 ? "1 day" : `${String(days)} days`;
}

interface RangeEndProps {
	readonly label: string;
	readonly value: string | null;
	/** The end the next tap sets. */
	readonly active: boolean;
}

function RangeEnd({ label, value, active }: RangeEndProps): React.JSX.Element {
	return (
		<View
			className={`flex-1 gap-0.5 rounded-xl px-3 py-2 ${active ? "border border-primary bg-card" : "border border-border bg-muted"}`}
			accessible
			accessibilityLabel={`${label}: ${value ?? "not chosen"}`}>
			<Text className="font-sans-medium text-xs text-muted-foreground">{label}</Text>
			<Text className={`font-sans-semibold text-sm ${value === null ? "text-muted-foreground" : "text-foreground"}`}>{value ?? "—"}</Text>
		</View>
	);
}

interface MonthStepProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly enabled: boolean;
	readonly onPress: () => void;
}

function MonthStep({ icon, label, enabled, onPress }: MonthStepProps): React.JSX.Element {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled: !enabled }}
			disabled={!enabled}
			onPress={onPress}
			className={`size-11 items-center justify-center rounded-full active:bg-muted ${enabled ? "" : "opacity-30"}`}>
			<Icon icon={icon} size="md" colorClassName="accent-foreground" />
		</Pressable>
	);
}

/** A Monday (5 Jan 2026): the weekday initials are read off the week that starts on it. */
const REFERENCE_MONDAY: LocalDate = "2026-01-05";
const DAYS_PER_WEEK = 7;
const WEEK_DAYS: readonly number[] = [...Array<number>(DAYS_PER_WEEK).keys()];

interface WeekdayHeaderProps {
	readonly format: Intl.DateTimeFormat;
}

function WeekdayHeader({ format }: WeekdayHeaderProps): React.JSX.Element {
	return (
		<View className="flex-row" importantForAccessibility="no-hide-descendants">
			{WEEK_DAYS.map((offset: number): React.JSX.Element => (
				<Text key={offset} className="font-sans-medium flex-1 text-center text-xs text-muted-foreground">
					{format.format(dateMsOf(REFERENCE_MONDAY) + offset * DAY_MS)}
				</Text>
			))}
		</View>
	);
}

const ROLE_WORDS: Readonly<Record<RangeDayRole, string>> = {
	none: "",
	start: ", start",
	end: ", end",
	single: ", selected",
	inside: ", in range",
};

/** Where the band behind a day reaches: across it, to its right half, to its left half, or nowhere. */
const BAND_CLASSES: Readonly<Record<RangeDayRole, string | null>> = {
	none: null,
	single: null,
	inside: "left-0 right-0",
	start: "left-1/2 right-0",
	end: "left-0 right-1/2",
};

interface DayCellProps {
	readonly day: LocalDate;
	readonly label: string;
	readonly role: RangeDayRole;
	readonly isToday: boolean;
	readonly enabled: boolean;
	readonly onPick: (day: LocalDate) => void;
}

function DayCell({ day, label, role, isToday, enabled, onPick }: DayCellProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(day);
	}, [day, onPick]);
	const isEnd = role === "start" || role === "end" || role === "single";
	const band = BAND_CLASSES[role];
	const dayNumber = String(new Date(dateMsOf(day)).getUTCDate());
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${label}${isToday ? ", today" : ""}${ROLE_WORDS[role]}`}
			accessibilityState={{ selected: role !== "none", disabled: !enabled }}
			disabled={!enabled}
			onPress={press}
			className="h-11 flex-1 items-center justify-center"
			testID={`day-${day}`}>
			{band === null ? null : <View className={`absolute inset-y-1 bg-primary/10 ${band}`} />}
			<View className={`size-10 items-center justify-center rounded-full ${isEnd ? "bg-primary" : ""} ${isToday && !isEnd ? "border border-primary" : ""}`}>
				<Text
					className={`font-sans text-sm tabular-nums ${isEnd ? "font-sans-semibold text-primary-foreground" : enabled ? "text-foreground" : "text-muted-foreground opacity-40"}`}>
					{dayNumber}
				</Text>
			</View>
		</Pressable>
	);
}
