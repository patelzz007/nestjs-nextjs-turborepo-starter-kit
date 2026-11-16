// One month's days, Monday first (or Sunday, with `weekStartsOn`), for every calendar picker (DateField,
// MultiDateField, DateRangePicker): a weekday header, then a row per week.
// Each day is a button named by its full date and what the caller says it is
// (`roleOf`: outside any selection, a picked day, or a range's start, end or
// middle, which is banded). Days outside `minDate`…`maxDate` cannot be
// picked; `today` is ringed. Presentational: the caller owns the month and
// the selection, and is told which day was tapped. Options: a square day
// mark, taller cells with a footer under each day (a price, an event dot),
// and a leading column of ISO week numbers. The ref reaches the grid's
// root view; `className` is merged last onto it.

import { DAY_MS, UTC_TIME_ZONE, type LocalDate } from "@workspace/shared";
import { cva } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { calendarDayMsOf, isoWeekOf, monthWeeks, type CalendarMonth, type RangeDayRole, type WeekStart } from "../lib/calendar";
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
	/** `circle` (default) or `square`: the shape of a picked day's mark. */
	readonly dayShape?: CalendarDayShape | undefined;
	/** `md` (default) or `lg`: a taller cell, with room for `renderDayFooter`. */
	readonly cellSize?: CalendarCellSize | undefined;
	/** Something small under a day's number: a price, an event dot. Decorative: put what it says in the day's name with `describeDay`. */
	readonly renderDayFooter?: ((day: LocalDate) => React.ReactNode) | undefined;
	/** Words added to a day's accessible name ("$89", "2 events"). */
	readonly describeDay?: ((day: LocalDate) => string | undefined) | undefined;
	/** A leading column of ISO week numbers. */
	readonly showWeekNumbers?: boolean | undefined;
	/** The day each week starts on: 1 Monday (default), 0 Sunday. */
	readonly weekStartsOn?: WeekStart | undefined;
	/** Extra classes for the grid, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The shape of a day's mark. */
export type CalendarDayShape = "circle" | "square";
/** How tall a day's cell is. */
export type CalendarCellSize = "md" | "lg";

/** The mark behind a day's number: filled at a selection's end, ringed on today, plain otherwise. */
export const calendarDayVariants = cva("size-10 items-center justify-center", {
	variants: {
		mark: {
			end: "bg-primary",
			today: "border border-primary",
			none: "",
		},
		shape: { circle: "rounded-full", square: "rounded-lg" },
	},
	defaultVariants: { mark: "none", shape: "circle" },
});

/** A day's cell: its height. */
export const calendarDayCellVariants = cva("flex-1 items-center justify-center", {
	variants: {
		size: { md: "h-11", lg: "h-16 gap-0.5" },
	},
	defaultVariants: { size: "md" },
});

/** A day's number: on the filled circle, pickable, or ruled out. */
export const calendarDayLabelVariants = cva("text-body tabular-nums", {
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
	React.forwardRef<ViewInstance, CalendarMonthGridProps>(function CalendarMonthGrid(
		{
			month,
			today,
			minDate,
			maxDate,
			locale,
			roleOf,
			onPick,
			isUnavailable,
			dayShape = "circle",
			cellSize = "md",
			renderDayFooter,
			describeDay,
			showWeekNumbers = false,
			weekStartsOn = 1,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const formats = React.useMemo(() => monthGridFormatsOf(locale), [locale]);
		const weeks = React.useMemo(() => monthWeeks(month, weekStartsOn), [month, weekStartsOn]);
		const isPickable = (day: LocalDate): boolean => isWithin(day, minDate, maxDate) && isUnavailable?.(day) !== true;
		return (
			<View ref={ref} className={cn("gap-2", className)} testID={testID}>
				<WeekdayHeader format={formats.weekday} showWeekNumbers={showWeekNumbers} weekStartsOn={weekStartsOn} />
				{weeks.map((week: readonly (LocalDate | null)[]): React.JSX.Element => {
					const firstDay = week.find((day: LocalDate | null): boolean => day !== null) ?? null;
					return (
						<View key={firstDay ?? ""} className="flex-row items-center">
							{showWeekNumbers && firstDay !== null ? <WeekNumber day={firstDay} /> : null}
							{week.map((day: LocalDate | null, slot: number): React.JSX.Element =>
								day === null ? (
									<View key={`blank-${String(slot)}`} className={calendarDayCellVariants({ size: cellSize })} />
								) : (
									<DayCell
										key={day}
										day={day}
										label={formats.full.format(calendarDayMsOf(day))}
										description={describeDay?.(day)}
										role={roleOf(day)}
										isToday={day === today}
										enabled={isPickable(day)}
										onPick={onPick}
										shape={dayShape}
										size={cellSize}
										footer={renderDayFooter?.(day)}
									/>
								),
							)}
						</View>
					);
				})}
			</View>
		);
	}),
);

/** A Sunday (4 Jan 2026): the weekday initials are read off the week that starts on it, or on the Monday after. */
const REFERENCE_SUNDAY: LocalDate = "2026-01-04";
const DAYS_PER_WEEK = 7;
const WEEK_DAYS: readonly number[] = [...Array<number>(DAYS_PER_WEEK).keys()];

interface WeekdayHeaderProps {
	readonly format: Intl.DateTimeFormat;
	/** Leave room for the week number column. */
	readonly showWeekNumbers: boolean;
	readonly weekStartsOn: WeekStart;
}

/** A week's ISO number, at the start of its row; screen readers hear it with the row's days' full dates instead. */
function WeekNumber({ day }: { readonly day: LocalDate }): React.JSX.Element {
	return (
		<Text importantForAccessibility="no" className="text-caption w-8 text-center font-sans text-muted-foreground tabular-nums">
			{String(isoWeekOf(day))}
		</Text>
	);
}

const WeekdayHeader = React.memo(function WeekdayHeader({ format, showWeekNumbers, weekStartsOn }: WeekdayHeaderProps): React.JSX.Element {
	return (
		<View className="flex-row" importantForAccessibility="no-hide-descendants">
			{showWeekNumbers ? <View className="w-8" /> : null}
			{WEEK_DAYS.map((offset: number): React.JSX.Element => (
				<Text key={offset} className="font-sans-medium text-caption flex-1 text-center text-muted-foreground">
					{format.format(calendarDayMsOf(REFERENCE_SUNDAY) + (weekStartsOn + offset) * DAY_MS)}
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
	readonly description: string | undefined;
	readonly shape: CalendarDayShape;
	readonly size: CalendarCellSize;
	readonly footer: React.ReactNode;
	readonly role: RangeDayRole;
	readonly isToday: boolean;
	readonly enabled: boolean;
	readonly onPick: (day: LocalDate) => void;
}

const DayCell = React.memo(function DayCell({ day, label, description, role, isToday, enabled, onPick, shape, size, footer }: DayCellProps): React.JSX.Element {
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
			accessibilityLabel={`${label}${isToday ? ", today" : ""}${ROLE_WORDS[role]}${description === undefined ? "" : `, ${description}`}`}
			accessibilityState={accessibilityState}
			disabled={!enabled}
			onPress={press}
			className={calendarDayCellVariants({ size })}
			testID={`day-${day}`}>
			{band === null ? null : <View className={cn("absolute inset-y-1 bg-primary/10", band)} />}
			<View className={calendarDayVariants({ mark, shape })}>
				<Text className={calendarDayLabelVariants({ state: labelState })}>{dayNumber}</Text>
			</View>
			{footer === undefined || footer === null ? null : <View importantForAccessibility="no-hide-descendants">{footer}</View>}
		</Pressable>
	);
});
