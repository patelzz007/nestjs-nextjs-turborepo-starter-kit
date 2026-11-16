// An inline month calendar (the web kit's `Calendar`): pick one day, several
// days, or a range from–to, on one month or two stacked months. The header
// steps a month at a time, and its month and year open lists to jump far
// (CalendarNavigator); the grid is CalendarMonthGrid's. Days outside
// `minDate`…`maxDate` or ruled out by `isUnavailable` cannot be picked; in
// range mode, a range that would cross one starts again from the tapped day.
//
// Controlled: `value` in, `onChange(next)` out, in the shape of the `mode`
// (a day or `null`; a list of days; a `{ from, to }` draft). The shown month
// is the calendar's own display state, starting on the picked day (or
// today), unless the caller owns it through `month` and `onMonthChange` (a
// "back to this month" button, a preset that jumps). Dates are calendar days
// (`YYYY-MM-DD`). The ref reaches the root view; `className` is merged last.

import { type LocalDate, UTC_TIME_ZONE } from "@workspace/shared";
import { cva } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import {
	addCalendarMonths,
	calendarDayMsOf,
	calendarMonthOf,
	clampCalendarMonth,
	type CalendarMonth,
	type DateRangeDraft,
	firstDayOf,
	pickRangeDay,
	rangeCrossesUnavailable,
	type RangeDayRole,
	rangeDayRoleOf,
	toggleCalendarDay,
	type WeekStart,
} from "../lib/calendar";
import { cn } from "../lib/cn";
import { playSelectionFeedback } from "../lib/haptics";
import { type CalendarCellSize, type CalendarDayShape, CalendarMonthGrid } from "./calendar-month-grid";
import { CalendarNavigator, type CalendarNavigatorLayout } from "./calendar-navigator";

export const calendarVariants = cva("gap-3", {
	variants: {
		/** `plain`: the calendar alone. `card`: on a card, padded and bordered. */
		variant: { plain: "", card: "rounded-card border border-border bg-card p-3" },
	},
	defaultVariants: { variant: "plain" },
});

export type CalendarVariant = "plain" | "card";

/** How many months show at once, stacked. */
export type CalendarMonthCount = 1 | 2;

interface CalendarBaseProps {
	/** Ringed on the calendar. */
	readonly today: LocalDate;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	/** The locale of the month and day names ("en-GB", "zh-CN"). */
	readonly locale: string;
	/** Days that cannot be picked besides those outside `minDate`…`maxDate` (weekends, booked days). */
	readonly isUnavailable?: ((day: LocalDate) => boolean) | undefined;
	/** The month shown (the first, with two): the caller's, with `onMonthChange`. */
	readonly month?: CalendarMonth | undefined;
	/** The shown month changed (a step, a jump from the lists). */
	readonly onMonthChange?: ((month: CalendarMonth) => void) | undefined;
	/** How many months show, stacked. Default 1. */
	readonly numberOfMonths?: CalendarMonthCount | undefined;
	/** Where the header puts the month and year and the steps. Default `centered`. */
	readonly navigationLayout?: CalendarNavigatorLayout | undefined;
	/** The shape of a picked day's mark. Default `circle`. */
	readonly dayShape?: CalendarDayShape | undefined;
	/** `lg`: taller cells, with room for `renderDayFooter`. Default `md`. */
	readonly cellSize?: CalendarCellSize | undefined;
	/** Something small under a day's number: a price, an event dot. Decorative: say it in `describeDay` too. */
	readonly renderDayFooter?: ((day: LocalDate) => React.ReactNode) | undefined;
	/** Words added to a day's accessible name ("$89", "2 events"). */
	readonly describeDay?: ((day: LocalDate) => string | undefined) | undefined;
	/** A leading column of ISO week numbers. */
	readonly showWeekNumbers?: boolean | undefined;
	/** The day each week starts on: 1 Monday (default), 0 Sunday. */
	readonly weekStartsOn?: WeekStart | undefined;
	readonly variant?: CalendarVariant | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export interface CalendarSingleProps extends CalendarBaseProps {
	readonly mode?: "single" | undefined;
	readonly value: LocalDate | null;
	readonly onChange: (day: LocalDate) => void;
}

export interface CalendarMultipleProps extends CalendarBaseProps {
	readonly mode: "multiple";
	readonly value: readonly LocalDate[];
	readonly onChange: (days: readonly LocalDate[]) => void;
	/** The most days that can be picked; the rest are ruled out once it is reached. */
	readonly maxDays?: number | undefined;
}

export interface CalendarRangeProps extends CalendarBaseProps {
	readonly mode: "range";
	readonly value: DateRangeDraft;
	readonly onChange: (range: DateRangeDraft) => void;
}

export type CalendarProps = CalendarSingleProps | CalendarMultipleProps | CalendarRangeProps;

/** The month a calendar opens on: the picked day's (the first picked, the range's start), else today's, kept within the bounds. */
export function initialCalendarMonth(props: CalendarProps): CalendarMonth {
	const anchor = anchorDayOf(props) ?? props.today;
	return clampCalendarMonth(calendarMonthOf(anchor), calendarMonthOf(props.minDate), calendarMonthOf(props.maxDate));
}

function anchorDayOf(props: CalendarProps): LocalDate | null {
	if (props.mode === "multiple") {
		return props.value.at(0) ?? null;
	}
	if (props.mode === "range") {
		return props.value.from;
	}
	return props.value;
}

/** What a day is in the selection, for the grid to draw and name. */
function roleOfDay(props: CalendarProps, day: LocalDate): RangeDayRole {
	if (props.mode === "multiple") {
		return props.value.includes(day) ? "single" : "none";
	}
	if (props.mode === "range") {
		return rangeDayRoleOf(props.value, day);
	}
	return props.value === day ? "single" : "none";
}

/** Reports the selection after a tap on `day`, in the shape of the mode. */
function pickDay(props: CalendarProps, day: LocalDate): void {
	playSelectionFeedback();
	if (props.mode === "multiple") {
		props.onChange(toggleCalendarDay(props.value, day, props.maxDays ?? null));
		return;
	}
	if (props.mode === "range") {
		const next = pickRangeDay(props.value, day);
		const crosses = next.from !== null && next.to !== null && props.isUnavailable !== undefined && rangeCrossesUnavailable(next.from, next.to, props.isUnavailable);
		props.onChange(crosses ? { from: day, to: null } : next);
		return;
	}
	props.onChange(day);
}

const MONTH_TITLE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = { month: "long", year: "numeric", timeZone: UTC_TIME_ZONE };

export const Calendar = React.memo(
	React.forwardRef<ViewInstance, CalendarProps>(function Calendar(props, ref): React.JSX.Element {
		const {
			today,
			minDate,
			maxDate,
			locale,
			isUnavailable,
			month: shownMonth,
			onMonthChange,
			numberOfMonths = 1,
			navigationLayout = "centered",
			dayShape = "circle",
			cellSize = "md",
			renderDayFooter,
			describeDay,
			showWeekNumbers = false,
			weekStartsOn = 1,
			variant = "plain",
			className,
			testID,
		} = props;
		const [ownMonth, setOwnMonth] = React.useState<CalendarMonth>(() => initialCalendarMonth(props));
		const month = shownMonth ?? ownMonth;
		const minMonth = calendarMonthOf(minDate);
		const maxMonth = calendarMonthOf(maxDate);
		const changeMonth = React.useCallback(
			(next: CalendarMonth): void => {
				setOwnMonth(next);
				onMonthChange?.(next);
			},
			[onMonthChange],
		);
		const roleOf = (day: LocalDate): RangeDayRole => roleOfDay(props, day);
		const onPick = (day: LocalDate): void => {
			pickDay(props, day);
		};
		// Once `maxDays` are picked, the other days are ruled out.
		const fullDays = props.mode === "multiple" && props.maxDays !== undefined && props.value.length >= props.maxDays ? props.value : null;
		const ruledOut = (day: LocalDate): boolean => (isUnavailable?.(day) ?? false) || (fullDays !== null && !fullDays.includes(day));
		const second = addCalendarMonths(month, 1);
		const secondTitle = new Intl.DateTimeFormat(locale, MONTH_TITLE_FORMAT_OPTIONS).format(calendarDayMsOf(firstDayOf(second)));
		const gridProps = {
			today,
			minDate,
			maxDate,
			locale,
			roleOf,
			onPick,
			isUnavailable: ruledOut,
			dayShape,
			cellSize,
			renderDayFooter,
			describeDay,
			showWeekNumbers,
			weekStartsOn,
		};
		return (
			<View ref={ref} testID={testID} className={cn(calendarVariants({ variant }), className)}>
				<CalendarNavigator month={month} minMonth={minMonth} maxMonth={maxMonth} locale={locale} onMonthChange={changeMonth} layout={navigationLayout}>
					<CalendarMonthGrid month={month} {...gridProps} />
					{numberOfMonths === 2 ? (
						<View className="gap-2 pt-3">
							<Text accessibilityRole="header" className="font-sans-semibold text-body-lg px-3 text-foreground">
								{secondTitle}
							</Text>
							<CalendarMonthGrid month={second} {...gridProps} />
						</View>
					) : null}
				</CalendarNavigator>
			</View>
		);
	}),
);
