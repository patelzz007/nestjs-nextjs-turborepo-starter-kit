// The navigation around a month calendar: a header with previous / next
// month steps and the shown month and year as buttons. Tapping the month
// swaps the calendar for the twelve months of the shown year; tapping the
// year swaps it for every year from `minMonth` to `maxMonth` (scrolled to the
// shown one), so a far month — a birth year, say — is two taps away instead
// of one step per month. Choosing goes back to the days. Months and years
// outside `minMonth`…`maxMonth` cannot be chosen; a year whose shown month is
// out of range lands on the nearest month that is in it.
//
// Presentational and controlled: the caller owns the shown month (and draws
// the day grid as `children`); which view is open is this component's own.

import { startOfLocalDateInTimeZone, UTC_TIME_ZONE } from "@workspace/shared";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import * as React from "react";
import { Pressable, ScrollView, Text, View, type LayoutChangeEvent } from "react-native";

import {
	addCalendarMonths,
	CALENDAR_MONTH_NUMBERS,
	calendarYearsBetween,
	clampCalendarMonth,
	compareCalendarMonths,
	firstDayOf,
	isCalendarMonthWithin,
	type CalendarMonth,
} from "../lib/calendar";
import { playSelectionFeedback } from "../lib/haptics";
import { Icon, type LucideIcon } from "./icon";

/** What sits under the header: the shown month's days, its year's months, or the years. */
export type CalendarView = "days" | "months" | "years";

export interface CalendarNavigatorProps {
	/** The month shown. */
	readonly month: CalendarMonth;
	/** The earliest month that can be shown. */
	readonly minMonth: CalendarMonth;
	/** The latest month that can be shown. */
	readonly maxMonth: CalendarMonth;
	/** The locale of the month names. */
	readonly locale: string;
	readonly onMonthChange: (month: CalendarMonth) => void;
	/** The shown month's day grid. */
	readonly children: React.ReactNode;
}

/** Month names are formatted at UTC midnight on the 1st, so no zone moves them into a neighbouring month. */
function monthMsOf(month: CalendarMonth): number {
	return startOfLocalDateInTimeZone(firstDayOf(month), UTC_TIME_ZONE);
}

export function CalendarNavigator({ month, minMonth, maxMonth, locale, onMonthChange, children }: CalendarNavigatorProps): React.JSX.Element {
	const [view, setView] = React.useState<CalendarView>("days");
	const formats = React.useMemo(
		() => ({
			long: new Intl.DateTimeFormat(locale, { month: "long", timeZone: UTC_TIME_ZONE }),
			short: new Intl.DateTimeFormat(locale, { month: "short", timeZone: UTC_TIME_ZONE }),
		}),
		[locale],
	);

	const step = React.useCallback(
		(offset: number): void => {
			onMonthChange(addCalendarMonths(month, offset));
		},
		[month, onMonthChange],
	);
	const showPrevious = React.useCallback((): void => {
		step(-1);
	}, [step]);
	const showNext = React.useCallback((): void => {
		step(1);
	}, [step]);
	const toggleMonths = React.useCallback((): void => {
		setView((current: CalendarView): CalendarView => (current === "months" ? "days" : "months"));
	}, []);
	const toggleYears = React.useCallback((): void => {
		setView((current: CalendarView): CalendarView => (current === "years" ? "days" : "years"));
	}, []);
	const choose = React.useCallback(
		(chosen: CalendarMonth): void => {
			playSelectionFeedback();
			onMonthChange(clampCalendarMonth(chosen, minMonth, maxMonth));
			setView("days");
		},
		[maxMonth, minMonth, onMonthChange],
	);

	const monthName = formats.long.format(monthMsOf(month));
	const yearName = String(month.year);
	const canGoBack = compareCalendarMonths(month, minMonth) > 0;
	const canGoOn = compareCalendarMonths(month, maxMonth) < 0;

	return (
		<View className="gap-2">
			<View className="flex-row items-center justify-between">
				<MonthStep icon={ChevronLeftIcon} label="Previous month" enabled={canGoBack} visible={view === "days"} onPress={showPrevious} />
				<View className="flex-row items-center gap-1">
					<ViewToggle text={monthName} label={`Month: ${monthName}`} hint="Shows the months to choose from" expanded={view === "months"} onPress={toggleMonths} />
					<ViewToggle text={yearName} label={`Year: ${yearName}`} hint="Shows the years to choose from" expanded={view === "years"} onPress={toggleYears} />
				</View>
				<MonthStep icon={ChevronRightIcon} label="Next month" enabled={canGoOn} visible={view === "days"} onPress={showNext} />
			</View>
			{view === "days" ? children : null}
			{view === "months" ? (
				<MonthChooser month={month} minMonth={minMonth} maxMonth={maxMonth} formatShort={formats.short} formatLong={formats.long} onChoose={choose} />
			) : null}
			{view === "years" ? <YearChooser month={month} minMonth={minMonth} maxMonth={maxMonth} onChoose={choose} /> : null}
		</View>
	);
}

interface MonthStepProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly enabled: boolean;
	/** Hidden (its space kept, so the header does not shift) while months or years are listed. */
	readonly visible: boolean;
	readonly onPress: () => void;
}

function MonthStep({ icon, label, enabled, visible, onPress }: MonthStepProps): React.JSX.Element {
	if (!visible) {
		return <View className="size-11" />;
	}
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

interface ViewToggleProps {
	readonly text: string;
	readonly label: string;
	readonly hint: string;
	/** Its list is open. */
	readonly expanded: boolean;
	readonly onPress: () => void;
}

function ViewToggle({ text, label, hint, expanded, onPress }: ViewToggleProps): React.JSX.Element {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={hint}
			accessibilityState={{ expanded }}
			onPress={onPress}
			className={`h-11 flex-row items-center gap-1 rounded-full px-3 active:bg-muted ${expanded ? "bg-muted" : ""}`}>
			<Text className="font-sans-semibold text-base text-foreground">{text}</Text>
			<Icon icon={expanded ? ChevronUpIcon : ChevronDownIcon} size="sm" colorClassName="accent-muted-foreground" />
		</Pressable>
	);
}

interface ChoiceCellProps {
	/** The month shown when this cell is chosen. */
	readonly choice: CalendarMonth;
	readonly text: string;
	readonly label: string;
	readonly selected: boolean;
	readonly enabled: boolean;
	readonly onChoose: (month: CalendarMonth) => void;
	readonly testID: string;
}

function ChoiceCell({ choice, text, label, selected, enabled, onChoose, testID }: ChoiceCellProps): React.JSX.Element {
	const onPress = React.useCallback((): void => {
		onChoose(choice);
	}, [choice, onChoose]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ selected, disabled: !enabled }}
			disabled={!enabled}
			onPress={onPress}
			className="h-11 flex-1 items-center justify-center px-1"
			testID={testID}>
			<View className={`h-10 w-full items-center justify-center rounded-full ${selected ? "bg-primary" : "active:bg-muted"}`}>
				<Text
					className={`font-sans text-sm tabular-nums ${selected ? "font-sans-semibold text-primary-foreground" : enabled ? "text-foreground" : "text-muted-foreground opacity-40"}`}>
					{text}
				</Text>
			</View>
		</Pressable>
	);
}

/** Splits `items` into rows of `size` (the last row may be shorter). */
function rowsOf<Item>(items: readonly Item[], size: number): readonly (readonly Item[])[] {
	return [...Array<number>(Math.ceil(items.length / size)).keys()].map((row: number): readonly Item[] => items.slice(row * size, (row + 1) * size));
}

const MONTH_COLUMNS = 3;
const MONTH_ROWS = rowsOf(CALENDAR_MONTH_NUMBERS, MONTH_COLUMNS);

interface MonthChooserProps {
	readonly month: CalendarMonth;
	readonly minMonth: CalendarMonth;
	readonly maxMonth: CalendarMonth;
	readonly formatShort: Intl.DateTimeFormat;
	readonly formatLong: Intl.DateTimeFormat;
	readonly onChoose: (month: CalendarMonth) => void;
}

function MonthChooser({ month, minMonth, maxMonth, formatShort, formatLong, onChoose }: MonthChooserProps): React.JSX.Element {
	return (
		<View className="gap-2 py-2">
			{MONTH_ROWS.map((row: readonly number[]): React.JSX.Element => (
				<View key={row.join("-")} className="flex-row">
					{row.map((monthNumber: number): React.JSX.Element => {
						const candidate: CalendarMonth = { year: month.year, month: monthNumber };
						return (
							<ChoiceCell
								key={monthNumber}
								choice={candidate}
								text={formatShort.format(monthMsOf(candidate))}
								label={`${formatLong.format(monthMsOf(candidate))} ${String(month.year)}`}
								selected={monthNumber === month.month}
								enabled={isCalendarMonthWithin(candidate, minMonth, maxMonth)}
								onChoose={onChoose}
								testID={`month-${String(monthNumber)}`}
							/>
						);
					})}
				</View>
			))}
		</View>
	);
}

const YEAR_COLUMNS = 4;
/** One row of years: `h-11` (44 points) — the scroll position is counted in rows. */
const YEAR_ROW_HEIGHT = 44;
/** Rows kept above the shown year's row when the list opens, so it is not flush with the top. */
const YEAR_ROWS_ABOVE = 1;

interface YearChooserProps {
	readonly month: CalendarMonth;
	readonly minMonth: CalendarMonth;
	readonly maxMonth: CalendarMonth;
	readonly onChoose: (month: CalendarMonth) => void;
}

function YearChooser({ month, minMonth, maxMonth, onChoose }: YearChooserProps): React.JSX.Element {
	const scrollRef = React.useRef<ScrollView>(null);
	const rows = React.useMemo(() => rowsOf(calendarYearsBetween(minMonth, maxMonth), YEAR_COLUMNS), [maxMonth, minMonth]);
	const shownRow = Math.floor((month.year - minMonth.year) / YEAR_COLUMNS);
	/** Opens on the shown year: scrolled once the list has a size to scroll in. */
	const scrollToShownYear = React.useCallback(
		(_event: LayoutChangeEvent): void => {
			scrollRef.current?.scrollTo({ y: Math.max(shownRow - YEAR_ROWS_ABOVE, 0) * YEAR_ROW_HEIGHT, animated: false });
		},
		[shownRow],
	);

	// `nestedScrollEnabled`: a sheet that scrolls may hold this list, and Android scrolls an inner list only with it.
	return (
		<ScrollView ref={scrollRef} onLayout={scrollToShownYear} nestedScrollEnabled className="h-64" contentContainerClassName="py-1" testID="year-list">
			{rows.map((row: readonly number[]): React.JSX.Element => (
				<View key={row.join("-")} className="flex-row">
					{row.map((year: number): React.JSX.Element => (
						<ChoiceCell
							key={year}
							choice={{ year, month: month.month }}
							text={String(year)}
							label={String(year)}
							selected={year === month.year}
							enabled
							onChoose={onChoose}
							testID={`year-${String(year)}`}
						/>
					))}
					{/* Blank slots keep the last row's years in their columns. */}
					{[...Array<number>(YEAR_COLUMNS - row.length).keys()].map((slot: number): React.JSX.Element => (
						<View key={`blank-${String(slot)}`} className="h-11 flex-1" />
					))}
				</View>
			))}
		</ScrollView>
	);
}
