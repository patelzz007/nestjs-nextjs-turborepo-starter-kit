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
// The ref reaches the root view; `className` is merged last onto it.

import { startOfLocalDateInTimeZone, UTC_TIME_ZONE } from "@workspace/shared";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import { cva } from "class-variance-authority";
import * as React from "react";
import { type LayoutChangeEvent, Pressable, ScrollView, type ScrollViewInstance, Text, View, type ViewInstance } from "react-native";

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
import { cn } from "../lib/cn";
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
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A month or year to choose in the lists: filled when it is the shown one. */
export const calendarChoiceVariants = cva("h-10 w-full items-center justify-center rounded-full", {
	variants: {
		selected: { true: "bg-primary", false: "active:bg-muted" },
	},
	defaultVariants: { selected: false },
});

/** A month's or year's text in the lists: on the filled circle, choosable, or out of range. */
export const calendarChoiceLabelVariants = cva("text-sm tabular-nums", {
	variants: {
		state: {
			selected: "font-sans-semibold text-primary-foreground",
			default: "font-sans text-foreground",
			disabled: "font-sans text-muted-foreground opacity-40",
		},
	},
	defaultVariants: { state: "default" },
});

/** The header's month and year buttons: tinted while their list is open. */
export const calendarViewToggleVariants = cva("h-11 flex-row items-center gap-1 rounded-full px-3 active:bg-muted", {
	variants: {
		expanded: { true: "bg-muted", false: "" },
	},
	defaultVariants: { expanded: false },
});

/** The previous / next month steps: faded at the first or last month. */
export const calendarMonthStepVariants = cva("size-11 items-center justify-center rounded-full active:bg-muted", {
	variants: {
		state: { default: "", disabled: "opacity-30" },
	},
	defaultVariants: { state: "default" },
});

/** Month names are formatted at UTC midnight on the 1st, so no zone moves them into a neighbouring month. */
function monthMsOf(month: CalendarMonth): number {
	return startOfLocalDateInTimeZone(firstDayOf(month), UTC_TIME_ZONE);
}

interface NavigatorFormats {
	readonly long: Intl.DateTimeFormat;
	readonly short: Intl.DateTimeFormat;
}

function navigatorFormatsOf(locale: string): NavigatorFormats {
	return {
		long: new Intl.DateTimeFormat(locale, { month: "long", timeZone: UTC_TIME_ZONE }),
		short: new Intl.DateTimeFormat(locale, { month: "short", timeZone: UTC_TIME_ZONE }),
	};
}

export const CalendarNavigator = React.memo(
	React.forwardRef<ViewInstance, CalendarNavigatorProps>(function CalendarNavigator(
		{ month, minMonth, maxMonth, locale, onMonthChange, children, className, testID },
		ref,
	): React.JSX.Element {
		const [view, setView] = React.useState<CalendarView>("days");
		const formats = React.useMemo(() => navigatorFormatsOf(locale), [locale]);

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
			<View ref={ref} className={cn("gap-2", className)} testID={testID}>
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
	}),
);

interface MonthStepProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly enabled: boolean;
	/** Hidden (its space kept, so the header does not shift) while months or years are listed. */
	readonly visible: boolean;
	readonly onPress: () => void;
}

const MonthStep = React.memo(function MonthStep({ icon, label, enabled, visible, onPress }: MonthStepProps): React.JSX.Element {
	const accessibilityState = React.useMemo(() => ({ disabled: !enabled }), [enabled]);
	if (!visible) {
		return <View className="size-11" />;
	}
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={accessibilityState}
			disabled={!enabled}
			onPress={onPress}
			className={calendarMonthStepVariants({ state: enabled ? "default" : "disabled" })}>
			<Icon icon={icon} size="md" colorClassName="accent-foreground" />
		</Pressable>
	);
});

interface ViewToggleProps {
	readonly text: string;
	readonly label: string;
	readonly hint: string;
	/** Its list is open. */
	readonly expanded: boolean;
	readonly onPress: () => void;
}

const ViewToggle = React.memo(function ViewToggle({ text, label, hint, expanded, onPress }: ViewToggleProps): React.JSX.Element {
	const accessibilityState = React.useMemo(() => ({ expanded }), [expanded]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={hint}
			accessibilityState={accessibilityState}
			onPress={onPress}
			className={calendarViewToggleVariants({ expanded })}>
			<Text className="font-sans-semibold text-base text-foreground">{text}</Text>
			<Icon icon={expanded ? ChevronUpIcon : ChevronDownIcon} size="sm" colorClassName="accent-muted-foreground" />
		</Pressable>
	);
});

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

const ChoiceCell = React.memo(function ChoiceCell({ choice, text, label, selected, enabled, onChoose, testID }: ChoiceCellProps): React.JSX.Element {
	const onPress = React.useCallback((): void => {
		onChoose(choice);
	}, [choice, onChoose]);
	const accessibilityState = React.useMemo(() => ({ selected, disabled: !enabled }), [enabled, selected]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={accessibilityState}
			disabled={!enabled}
			onPress={onPress}
			className="h-11 flex-1 items-center justify-center px-1"
			testID={testID}>
			<View className={calendarChoiceVariants({ selected })}>
				<Text className={calendarChoiceLabelVariants({ state: selected ? "selected" : enabled ? "default" : "disabled" })}>{text}</Text>
			</View>
		</Pressable>
	);
});

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

const MonthChooser = React.memo(function MonthChooser({ month, minMonth, maxMonth, formatShort, formatLong, onChoose }: MonthChooserProps): React.JSX.Element {
	const shownYear = month.year;
	/** The shown year's months, row by row; stable while the year is, so each cell keeps its memo. */
	const candidateRows = React.useMemo(
		() => MONTH_ROWS.map((row: readonly number[]): readonly CalendarMonth[] => row.map((monthNumber: number): CalendarMonth => ({ year: shownYear, month: monthNumber }))),
		[shownYear],
	);
	return (
		<View className="gap-2 py-2">
			{candidateRows.map((row: readonly CalendarMonth[]): React.JSX.Element => (
				<View key={row.map((candidate: CalendarMonth): string => String(candidate.month)).join("-")} className="flex-row">
					{row.map((candidate: CalendarMonth): React.JSX.Element => (
						<ChoiceCell
							key={candidate.month}
							choice={candidate}
							text={formatShort.format(monthMsOf(candidate))}
							label={`${formatLong.format(monthMsOf(candidate))} ${String(shownYear)}`}
							selected={candidate.month === month.month}
							enabled={isCalendarMonthWithin(candidate, minMonth, maxMonth)}
							onChoose={onChoose}
							testID={`month-${String(candidate.month)}`}
						/>
					))}
				</View>
			))}
		</View>
	);
});

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

const YearChooser = React.memo(function YearChooser({ month, minMonth, maxMonth, onChoose }: YearChooserProps): React.JSX.Element {
	const scrollRef = React.useRef<ScrollViewInstance>(null);
	const shownMonthNumber = month.month;
	/** Every year in range at the shown month, row by row (choosing one keeps the month). */
	const rows = React.useMemo(
		() =>
			rowsOf(
				calendarYearsBetween(minMonth, maxMonth).map((year: number): CalendarMonth => ({ year, month: shownMonthNumber })),
				YEAR_COLUMNS,
			),
		[maxMonth, minMonth, shownMonthNumber],
	);
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
			{rows.map((row: readonly CalendarMonth[]): React.JSX.Element => (
				<View key={row.map((candidate: CalendarMonth): string => String(candidate.year)).join("-")} className="flex-row">
					{row.map((candidate: CalendarMonth): React.JSX.Element => (
						<ChoiceCell
							key={candidate.year}
							choice={candidate}
							text={String(candidate.year)}
							label={String(candidate.year)}
							selected={candidate.year === month.year}
							enabled
							onChoose={onChoose}
							testID={`year-${String(candidate.year)}`}
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
});
