// One month's days, Monday first, for every calendar picker (DateField,
// MultiDateField, DateRangePicker): a weekday header, then a row per week.
// Each day is a button named by its full date and what the caller says it is
// (`roleOf`: outside any selection, a picked day, or a range's start, end or
// middle, which is banded). Days outside `minDate`…`maxDate` cannot be
// picked; `today` is ringed. Presentational: the caller owns the month and
// the selection, and is told which day was tapped. The ref reaches the grid's
// root view; `className` is merged last onto it.

import { DAY_MS, UTC_TIME_ZONE, type LocalDate } from "@workspace/shared";
import { cva } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { calendarDayMsOf, monthWeeks, type CalendarMonth, type RangeDayRole } from "../lib/calendar";
import { cn } from "../lib/cn";

export interface CalendarMonthGridProps {
	readonly month: CalendarMonth;
	/** Ringed on the calendar. */
	readonly today: LocalDate;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	/** The locale of the day and weekday names. */
	readonly locale: string;
	/** What a day is in the selection: drawn and named from it. */
	readonly roleOf: (day: LocalDate) => RangeDayRole;
	readonly onPick: (day: LocalDate) => void;
	/** Days the caller rules out besides those outside `minDate`…`maxDate` (the unpicked days once a picker is full). */
	readonly isUnavailable?: ((day: LocalDate) => boolean) | undefined;
	/** Extra classes for the grid, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The circle behind a day's number: filled at a selection's end, ringed on today, plain otherwise. */
export const calendarDayVariants = cva("size-10 items-center justify-center rounded-full", {
	variants: {
		mark: {
			end: "bg-primary",
			today: "border border-primary",
			none: "",
		},
	},
	defaultVariants: { mark: "none" },
});

/** A day's number: on the filled circle, pickable, or ruled out. */
export const calendarDayLabelVariants = cva("text-sm tabular-nums", {
	variants: {
		state: {
			selected: "font-sans-semibold text-primary-foreground",
			default: "font-sans text-foreground",
			disabled: "font-sans text-muted-foreground opacity-40",
		},
	},
	defaultVariants: { state: "default" },
});

/** `day` is from `first` to `last`, both included (`YYYY-MM-DD` strings sort as dates). */
function isWithin(day: LocalDate, first: LocalDate, last: LocalDate): boolean {
	return day >= first && day <= last;
}

interface MonthGridFormats {
	readonly full: Intl.DateTimeFormat;
	readonly weekday: Intl.DateTimeFormat;
}

function monthGridFormatsOf(locale: string): MonthGridFormats {
	return {
		full: new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: UTC_TIME_ZONE }),
		weekday: new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: UTC_TIME_ZONE }),
	};
}

export const CalendarMonthGrid = React.memo(
	React.forwardRef<View, CalendarMonthGridProps>(function CalendarMonthGrid(
		{ month, today, minDate, maxDate, locale, roleOf, onPick, isUnavailable, className, testID },
		ref,
	): React.JSX.Element {
		const formats = React.useMemo(() => monthGridFormatsOf(locale), [locale]);
		const weeks = React.useMemo(() => monthWeeks(month), [month]);
		const isPickable = (day: LocalDate): boolean => isWithin(day, minDate, maxDate) && isUnavailable?.(day) !== true;
		return (
			<View ref={ref} className={cn("gap-2", className)} testID={testID}>
				<WeekdayHeader format={formats.weekday} />
				{weeks.map((week: readonly (LocalDate | null)[]): React.JSX.Element => (
					<View key={week.find((day: LocalDate | null): boolean => day !== null) ?? ""} className="flex-row">
						{week.map((day: LocalDate | null, slot: number): React.JSX.Element =>
							day === null ? (
								<View key={`blank-${String(slot)}`} className="h-11 flex-1" />
							) : (
								<DayCell
									key={day}
									day={day}
									label={formats.full.format(calendarDayMsOf(day))}
									role={roleOf(day)}
									isToday={day === today}
									enabled={isPickable(day)}
									onPick={onPick}
								/>
							),
						)}
					</View>
				))}
			</View>
		);
	}),
);

/** A Monday (5 Jan 2026): the weekday initials are read off the week that starts on it. */
const REFERENCE_MONDAY: LocalDate = "2026-01-05";
const DAYS_PER_WEEK = 7;
const WEEK_DAYS: readonly number[] = [...Array<number>(DAYS_PER_WEEK).keys()];

interface WeekdayHeaderProps {
	readonly format: Intl.DateTimeFormat;
}

const WeekdayHeader = React.memo(function WeekdayHeader({ format }: WeekdayHeaderProps): React.JSX.Element {
	return (
		<View className="flex-row" importantForAccessibility="no-hide-descendants">
			{WEEK_DAYS.map((offset: number): React.JSX.Element => (
				<Text key={offset} className="font-sans-medium flex-1 text-center text-xs text-muted-foreground">
					{format.format(calendarDayMsOf(REFERENCE_MONDAY) + offset * DAY_MS)}
				</Text>
			))}
		</View>
	);
});

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

const DayCell = React.memo(function DayCell({ day, label, role, isToday, enabled, onPick }: DayCellProps): React.JSX.Element {
	const press = React.useCallback((): void => {
		onPick(day);
	}, [day, onPick]);
	const isEnd = role === "start" || role === "end" || role === "single";
	const isSelected = role !== "none";
	const accessibilityState = React.useMemo(() => ({ selected: isSelected, disabled: !enabled }), [enabled, isSelected]);
	const band = BAND_CLASSES[role];
	const dayNumber = String(new Date(calendarDayMsOf(day)).getUTCDate());
	const mark = isEnd ? "end" : isToday ? "today" : "none";
	const labelState = isEnd ? "selected" : enabled ? "default" : "disabled";
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${label}${isToday ? ", today" : ""}${ROLE_WORDS[role]}`}
			accessibilityState={accessibilityState}
			disabled={!enabled}
			onPress={press}
			className="h-11 flex-1 items-center justify-center"
			testID={`day-${day}`}>
			{band === null ? null : <View className={cn("absolute inset-y-1 bg-primary/10", band)} />}
			<View className={calendarDayVariants({ mark })}>
				<Text className={calendarDayLabelVariants({ state: labelState })}>{dayNumber}</Text>
			</View>
		</Pressable>
	);
});
