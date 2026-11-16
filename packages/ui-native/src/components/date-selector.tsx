// A date filter (the web kit's `DateSelector`): pick a day, a month, a
// quarter, a half year or a year, as "is", "before", "after" or "between" —
// a report's period, a list's due-date filter. Tabs choose the filter and
// the period; the body is a calendar for days, or a year's months, quarters
// or halves (with a year stepper), or a grid of years. "Between" picks the
// two ends of a range. A typed entry reads `2025`, `Q1 2026` or a day in the
// caller's format. `DateSelectorField` is a field that opens the selector in
// a sheet, with Cancel and Apply over a draft.
//
// Controlled: `value` in, `onChange(next)` out, after every pick, clear and
// tab change (lib/date-selector.ts holds the value's shape, its text and the
// typed-entry parser). Days are calendar days (`YYYY-MM-DD`). Every word can
// be replaced (`labels`) for another language. The ref reaches the root view.

import type { LocalDate } from "@workspace/shared";
import { cva } from "class-variance-authority";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { type DateRangeDraft, type WeekStart } from "../lib/calendar";
import { cn } from "../lib/cn";
import {
	clearedDateSelectorValue,
	DATE_SELECTOR_FILTER_TYPES,
	DATE_SELECTOR_PERIOD_TYPES,
	type DateSelectorDayFormat,
	type DateSelectorFilterType,
	type DateSelectorPeriodPoint,
	type DateSelectorPeriodType,
	type DateSelectorValue,
	DEFAULT_DATE_SELECTOR_DAY_FORMAT,
	formatDateSelectorValue,
	isPeriodInRange,
	nextPeriodRange,
	parseDateSelectorInput,
	periodKey,
	pickedPeriodIndex,
	withPeriodPoint,
	yearsBetween,
} from "../lib/date-selector";
import { playSelectionFeedback } from "../lib/haptics";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { CalendarField } from "./calendar-field";
import { Icon } from "./icon";
import { Input } from "./input";
import { ToggleGroup, type ToggleGroupOption } from "./toggle-group";

/* -------------------------------------------------------------------------- */
/*                                   Labels                                   */
/* -------------------------------------------------------------------------- */

/** Every word the selector shows or says. Arrays are indexed by period (month 0–11, quarter 0–3, half 0–1). */
export interface DateSelectorLabels {
	readonly selectDate: string;
	readonly apply: string;
	readonly cancel: string;
	readonly clear: string;
	readonly today: string;
	readonly previousYear: string;
	readonly nextYear: string;
	readonly filterTypeGroup: string;
	readonly periodTypeGroup: string;
	readonly filterTypes: Readonly<Record<DateSelectorFilterType, string>>;
	readonly periodTypes: Readonly<Record<DateSelectorPeriodType, string>>;
	readonly months: readonly string[];
	readonly monthsShort: readonly string[];
	readonly quarters: readonly string[];
	readonly halfYears: readonly string[];
	/** The typed entry's placeholder and name. */
	readonly placeholder: string;
	/** Shown when the typed text is not a date, a quarter or a year. */
	readonly invalidInput: string;
}

export const DEFAULT_DATE_SELECTOR_LABELS: DateSelectorLabels = {
	selectDate: "Select date",
	apply: "Apply",
	cancel: "Cancel",
	clear: "Clear",
	today: "Today",
	previousYear: "Previous year",
	nextYear: "Next year",
	filterTypeGroup: "Filter",
	periodTypeGroup: "Period",
	filterTypes: { is: "Is", before: "Before", after: "After", between: "Between" },
	periodTypes: { day: "Day", month: "Month", quarter: "Quarter", "half-year": "Half-year", year: "Year" },
	months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
	monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	quarters: ["Q1", "Q2", "Q3", "Q4"],
	halfYears: ["H1", "H2"],
	placeholder: "Type a date, Q1 2026 or 2026",
	invalidInput: "Type a date, a quarter like Q1 2026, or a year.",
};

/* -------------------------------------------------------------------------- */
/*                                 Period grid                                */
/* -------------------------------------------------------------------------- */

/** A month, quarter, half or year to pick: filled at a pick or a range's end, tinted inside a range. */
export const dateSelectorCellVariants = cva("h-11 items-center justify-center rounded-lg border", {
	variants: {
		mark: {
			picked: "border-primary bg-primary",
			inside: "border-transparent bg-primary/10",
			none: "border-border active:bg-muted",
		},
	},
	defaultVariants: { mark: "none" },
});

/** The room a cell takes in its row: how many cells share a row. */
export const dateSelectorCellSlotVariants = cva("p-1", {
	variants: {
		columns: { 2: "w-1/2", 3: "w-1/3", 4: "w-1/4" },
	},
	defaultVariants: { columns: 3 },
});

const dateSelectorCellLabelVariants = cva("text-body", {
	variants: {
		mark: {
			picked: "font-sans-semibold text-primary-foreground",
			inside: "font-sans-medium text-foreground",
			none: "font-sans text-foreground",
		},
	},
	defaultVariants: { mark: "none" },
});

type CellMark = "picked" | "inside" | "none";
type CellColumns = 2 | 3 | 4;

interface PeriodCellProps {
	readonly point: DateSelectorPeriodPoint;
	readonly text: string;
	readonly label: string;
	readonly mark: CellMark;
	readonly columns: CellColumns;
	readonly onPick: (point: DateSelectorPeriodPoint) => void;
}

const PeriodCell = React.memo(function PeriodCell({ point, text, label, mark, columns, onPick }: PeriodCellProps): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(point);
	}, [onPick, point]);
	const accessibilityState = React.useMemo(() => ({ selected: mark !== "none" }), [mark]);
	return (
		<View className={dateSelectorCellSlotVariants({ columns })}>
			<Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={accessibilityState} onPress={pick} className={dateSelectorCellVariants({ mark })}>
				<Text className={dateSelectorCellLabelVariants({ mark })}>{text}</Text>
			</Pressable>
		</View>
	);
});

/** How a period's cells are laid out and named. */
interface PeriodGrid {
	readonly names: readonly string[];
	readonly longNames: readonly string[];
	readonly columns: CellColumns;
}

function periodGridOf(period: Exclude<DateSelectorPeriodType, "day" | "year">, labels: DateSelectorLabels): PeriodGrid {
	switch (period) {
		case "month":
			return { names: labels.monthsShort, longNames: labels.months, columns: 3 };
		case "quarter":
			return { names: labels.quarters, longNames: labels.quarters, columns: 2 };
		case "half-year":
			return { names: labels.halfYears, longNames: labels.halfYears, columns: 2 };
		default:
			return assertNeverGrid(period);
	}
}

function assertNeverGrid(value: never): never {
	throw new Error(`Unhandled period grid: ${String(value)}`);
}

/** Where a cell stands in the value: picked, inside a range, or neither. */
function markOf(value: DateSelectorValue, point: DateSelectorPeriodPoint, isRange: boolean): CellMark {
	if (isRange) {
		const isEnd = (end: DateSelectorPeriodPoint | undefined): boolean => end !== undefined && periodKey(end) === periodKey(point);
		if (isEnd(value.rangeStart) || isEnd(value.rangeEnd)) {
			return "picked";
		}
		return isPeriodInRange(point, value.rangeStart, value.rangeEnd) ? "inside" : "none";
	}
	return value.year === point.year && pickedPeriodIndex(value) === point.value ? "picked" : "none";
}

/* -------------------------------------------------------------------------- */
/*                                  Selector                                  */
/* -------------------------------------------------------------------------- */

export const dateSelectorVariants = cva("gap-3", {
	variants: {
		variant: { plain: "", card: "rounded-card border border-border bg-card p-3" },
	},
	defaultVariants: { variant: "plain" },
});

export type DateSelectorVariant = "plain" | "card";

export interface DateSelectorProps {
	readonly value: DateSelectorValue;
	readonly onChange: (value: DateSelectorValue) => void;
	/** Today: ringed on the calendar, and what the Today button picks. */
	readonly today: LocalDate;
	/** The first and last years offered. */
	readonly minYear: number;
	readonly maxYear: number;
	/** The locale of the calendar's day and month names. */
	readonly locale: string;
	/** The period tabs offered, in order. Default all five. */
	readonly periodTypes?: readonly DateSelectorPeriodType[] | undefined;
	/** Locks the filter (its tabs are hidden). */
	readonly presetMode?: DateSelectorFilterType | undefined;
	/** "Between" picks a range. Default `true`; `false` hides the Between tab. */
	readonly allowRange?: boolean | undefined;
	/** Show the typed entry. Default `true`. */
	readonly showInput?: boolean | undefined;
	/** How a day is written and typed. Default `dd/MM/yyyy`. */
	readonly dayFormat?: DateSelectorDayFormat | undefined;
	/** The day each calendar week starts on: 1 Monday (default), 0 Sunday. */
	readonly weekStartsOn?: WeekStart | undefined;
	readonly labels?: Partial<DateSelectorLabels> | undefined;
	readonly variant?: DateSelectorVariant | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const TODAY_YEAR_DIGITS = 4;
const MONTH_START = 5;
const MONTH_END = 7;
const MONTHS_PER_QUARTER = 3;
const MONTHS_PER_HALF = 6;

/** Today as a period point of `period`. */
function todayPoint(today: LocalDate, period: DateSelectorPeriodType): DateSelectorPeriodPoint {
	const year = Number(today.slice(0, TODAY_YEAR_DIGITS));
	const month = Number(today.slice(MONTH_START, MONTH_END)) - 1;
	switch (period) {
		case "month":
			return { year, value: month };
		case "quarter":
			return { year, value: Math.floor(month / MONTHS_PER_QUARTER) };
		case "half-year":
			return { year, value: Math.floor(month / MONTHS_PER_HALF) };
		case "day":
		case "year":
			return { year, value: 0 };
		default:
			return assertNeverGrid(period);
	}
}

export const DateSelector = React.memo(
	React.forwardRef<ViewInstance, DateSelectorProps>(function DateSelector(
		{
			value,
			onChange,
			today,
			minYear,
			maxYear,
			locale,
			periodTypes = DATE_SELECTOR_PERIOD_TYPES,
			presetMode,
			allowRange = true,
			showInput = true,
			dayFormat = DEFAULT_DATE_SELECTOR_DAY_FORMAT,
			weekStartsOn = 1,
			labels: labelOverrides,
			variant = "plain",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const labels = React.useMemo((): DateSelectorLabels => ({ ...DEFAULT_DATE_SELECTOR_LABELS, ...labelOverrides }), [labelOverrides]);
		const [shownYear, setShownYear] = React.useState<number>(value.year ?? value.rangeStart?.year ?? todayPoint(today, "year").year);
		const [typed, setTyped] = React.useState("");
		const [typedInvalid, setTypedInvalid] = React.useState(false);
		const isRange = allowRange && value.operator === "between";

		const filterOptions = React.useMemo(
			(): readonly ToggleGroupOption<DateSelectorFilterType>[] =>
				DATE_SELECTOR_FILTER_TYPES.filter((type: DateSelectorFilterType): boolean => allowRange || type !== "between").map(
					(type: DateSelectorFilterType): ToggleGroupOption<DateSelectorFilterType> => ({ value: type, label: labels.filterTypes[type] }),
				),
			[allowRange, labels.filterTypes],
		);
		const periodOptions = React.useMemo(
			(): readonly ToggleGroupOption<DateSelectorPeriodType>[] =>
				periodTypes.map((type: DateSelectorPeriodType): ToggleGroupOption<DateSelectorPeriodType> => ({ value: type, label: labels.periodTypes[type] })),
			[labels.periodTypes, periodTypes],
		);

		const change = React.useCallback(
			(next: DateSelectorValue): void => {
				playSelectionFeedback();
				onChange(next);
			},
			[onChange],
		);
		const setFilter = React.useCallback(
			(operator: DateSelectorFilterType | null): void => {
				if (operator !== null) {
					change({ ...clearedDateSelectorValue(value), operator });
				}
			},
			[change, value],
		);
		const setPeriod = React.useCallback(
			(period: DateSelectorPeriodType | null): void => {
				if (period !== null) {
					change({ period, operator: value.operator });
				}
			},
			[change, value.operator],
		);
		const pickPoint = React.useCallback(
			(point: DateSelectorPeriodPoint): void => {
				change(isRange ? nextPeriodRange(value, point) : withPeriodPoint(value, point));
			},
			[change, isRange, value],
		);
		const pickDay = React.useCallback(
			(day: LocalDate): void => {
				change({ ...value, startDate: day, endDate: undefined });
			},
			[change, value],
		);
		const pickDayRange = React.useCallback(
			(range: DateRangeDraft): void => {
				change({ ...value, startDate: range.from ?? undefined, endDate: range.to ?? undefined });
			},
			[change, value],
		);
		const pickToday = React.useCallback((): void => {
			const point = todayPoint(today, value.period);
			setShownYear(point.year);
			change(value.period === "day" ? { ...clearedDateSelectorValue(value), startDate: today } : withPeriodPoint(clearedDateSelectorValue(value), point));
		}, [change, today, value]);
		const clear = React.useCallback((): void => {
			change(clearedDateSelectorValue(value));
		}, [change, value]);
		const previousYear = React.useCallback((): void => {
			setShownYear((year: number): number => Math.max(minYear, year - 1));
		}, [minYear]);
		const nextYear = React.useCallback((): void => {
			setShownYear((year: number): number => Math.min(maxYear, year + 1));
		}, [maxYear]);
		const changeTyped = React.useCallback((text: string): void => {
			setTyped(text);
			setTypedInvalid(false);
		}, []);
		const submitTyped = React.useCallback((): void => {
			const parsed = parseDateSelectorInput(typed, { operator: value.operator, dayFormats: [dayFormat], today });
			if (parsed === null) {
				setTypedInvalid(true);
				return;
			}
			setTyped("");
			setShownYear(parsed.year ?? shownYearOfDay(parsed.startDate) ?? shownYear);
			change(parsed);
		}, [change, dayFormat, shownYear, today, typed, value.operator]);

		const dayRange = React.useMemo((): DateRangeDraft => ({ from: value.startDate ?? null, to: value.endDate ?? null }), [value.endDate, value.startDate]);
		const minDate = `${String(minYear)}-01-01`;
		const maxDate = `${String(maxYear)}-12-31`;

		return (
			<View ref={ref} testID={testID} className={cn(dateSelectorVariants({ variant }), className)}>
				{presetMode === undefined ? (
					<ToggleGroup
						type="single"
						label={labels.filterTypeGroup}
						options={filterOptions}
						value={value.operator}
						onChange={setFilter}
						size="sm"
						spacing="attached"
						variant="outline"
					/>
				) : null}
				{periodOptions.length > 1 ? (
					<ToggleGroup
						type="single"
						label={labels.periodTypeGroup}
						options={periodOptions}
						value={value.period}
						onChange={setPeriod}
						size="sm"
						spacing="attached"
						variant="outline"
					/>
				) : null}
				{showInput ? (
					<View className="gap-1">
						<Input
							value={typed}
							onChange={changeTyped}
							placeholder={labels.placeholder}
							accessibilityLabel={labels.placeholder}
							autoCapitalize="characters"
							autoCorrect={false}
							returnKeyType="done"
							onSubmitEditing={submitTyped}
							invalid={typedInvalid}
						/>
						{typedInvalid ? (
							<Text accessibilityRole="alert" className="text-caption font-sans text-destructive-foreground">
								{labels.invalidInput}
							</Text>
						) : null}
					</View>
				) : null}
				<DateSelectorBody
					value={value}
					isRange={isRange}
					today={today}
					minDate={minDate}
					maxDate={maxDate}
					minYear={minYear}
					maxYear={maxYear}
					locale={locale}
					weekStartsOn={weekStartsOn}
					labels={labels}
					shownYear={shownYear}
					dayRange={dayRange}
					onPickDay={pickDay}
					onPickDayRange={pickDayRange}
					onPickPoint={pickPoint}
					onPreviousYear={previousYear}
					onNextYear={nextYear}
				/>
				<View className="flex-row gap-2">
					<Button label={labels.today} variant="outline" size="sm" onPress={pickToday} />
					<Button label={labels.clear} variant="ghost" size="sm" onPress={clear} />
				</View>
			</View>
		);
	}),
);

/** The year a typed day lands the year stepper on. */
function shownYearOfDay(day: LocalDate | undefined): number | undefined {
	return day === undefined ? undefined : Number(day.slice(0, TODAY_YEAR_DIGITS));
}

interface DateSelectorBodyProps {
	readonly value: DateSelectorValue;
	readonly isRange: boolean;
	readonly today: LocalDate;
	readonly minDate: LocalDate;
	readonly maxDate: LocalDate;
	readonly minYear: number;
	readonly maxYear: number;
	readonly locale: string;
	readonly weekStartsOn: WeekStart;
	readonly labels: DateSelectorLabels;
	readonly shownYear: number;
	readonly dayRange: DateRangeDraft;
	readonly onPickDay: (day: LocalDate) => void;
	readonly onPickDayRange: (range: DateRangeDraft) => void;
	readonly onPickPoint: (point: DateSelectorPeriodPoint) => void;
	readonly onPreviousYear: () => void;
	readonly onNextYear: () => void;
}

/** The selector's body for its period: a calendar, a year's periods, or the years. */
function DateSelectorBody({
	value,
	isRange,
	today,
	minDate,
	maxDate,
	minYear,
	maxYear,
	locale,
	weekStartsOn,
	labels,
	shownYear,
	dayRange,
	onPickDay,
	onPickDayRange,
	onPickPoint,
	onPreviousYear,
	onNextYear,
}: DateSelectorBodyProps): React.JSX.Element {
	if (value.period === "day") {
		return isRange ? (
			<Calendar mode="range" today={today} minDate={minDate} maxDate={maxDate} locale={locale} weekStartsOn={weekStartsOn} value={dayRange} onChange={onPickDayRange} />
		) : (
			<Calendar today={today} minDate={minDate} maxDate={maxDate} locale={locale} weekStartsOn={weekStartsOn} value={value.startDate ?? null} onChange={onPickDay} />
		);
	}
	if (value.period === "year") {
		return (
			<View className="flex-row flex-wrap">
				{yearsBetween(minYear, maxYear).map((year: number): React.JSX.Element => {
					const point = { year, value: 0 };
					return <PeriodCell key={year} point={point} text={String(year)} label={String(year)} mark={markOf(value, point, isRange)} columns={4} onPick={onPickPoint} />;
				})}
			</View>
		);
	}
	const grid = periodGridOf(value.period, labels);
	return (
		<View className="gap-2">
			<View className="flex-row items-center justify-between">
				<YearStep icon="previous" label={labels.previousYear} enabled={shownYear > minYear} onPress={onPreviousYear} />
				<Text accessibilityRole="header" className="font-sans-semibold text-body-lg text-foreground tabular-nums">
					{String(shownYear)}
				</Text>
				<YearStep icon="next" label={labels.nextYear} enabled={shownYear < maxYear} onPress={onNextYear} />
			</View>
			<View className="flex-row flex-wrap">
				{grid.names.map((name: string, index: number): React.JSX.Element => {
					const point = { year: shownYear, value: index };
					return (
						<PeriodCell
							key={name}
							point={point}
							text={name}
							label={`${grid.longNames.at(index) ?? name} ${String(shownYear)}`}
							mark={markOf(value, point, isRange)}
							columns={grid.columns}
							onPick={onPickPoint}
						/>
					);
				})}
			</View>
		</View>
	);
}

interface YearStepProps {
	readonly icon: "previous" | "next";
	readonly label: string;
	readonly enabled: boolean;
	readonly onPress: () => void;
}

function YearStep({ icon, label, enabled, onPress }: YearStepProps): React.JSX.Element {
	const accessibilityState = React.useMemo(() => ({ disabled: !enabled }), [enabled]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={accessibilityState}
			disabled={!enabled}
			onPress={onPress}
			className={cn("size-11 items-center justify-center rounded-full active:bg-muted", enabled ? undefined : "opacity-30")}>
			<Icon icon={icon === "previous" ? ChevronLeftIcon : ChevronRightIcon} size="md" colorClassName="accent-foreground" />
		</Pressable>
	);
}

/* -------------------------------------------------------------------------- */
/*                                    Field                                   */
/* -------------------------------------------------------------------------- */

export interface DateSelectorFieldProps extends Omit<DateSelectorProps, "variant" | "className" | "testID"> {
	/** The field's label, and the sheet's title. */
	readonly label: string;
	/** Shown while nothing is picked. Default the labels' "Select date". */
	readonly placeholder?: string | undefined;
	readonly hint?: string | undefined;
	readonly error?: string | undefined;
	readonly disabled?: boolean | undefined;
	/** Extra classes for the field, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface DraftSheetProps extends Omit<DateSelectorProps, "variant" | "className" | "testID"> {
	readonly close: () => void;
	readonly labels: DateSelectorLabels;
}

/** The sheet's content: the selector over a draft, applied or dropped. */
function DateSelectorDraftSheet({ value, onChange, close, labels, ...selectorProps }: DraftSheetProps): React.JSX.Element {
	const [draft, setDraft] = React.useState<DateSelectorValue>(value);
	const apply = React.useCallback((): void => {
		onChange(draft);
		close();
	}, [close, draft, onChange]);
	return (
		<View className="gap-3">
			<DateSelector {...selectorProps} labels={labels} value={draft} onChange={setDraft} />
			<View className="flex-row gap-2">
				<Button label={labels.cancel} variant="outline" onPress={close} className="flex-1" />
				<Button label={labels.apply} onPress={apply} className="flex-1" />
			</View>
		</View>
	);
}

export const DateSelectorField = React.memo(
	React.forwardRef<ViewInstance, DateSelectorFieldProps>(function DateSelectorField(
		{ label, placeholder, hint, error, disabled = false, className, testID, labels: labelOverrides, dayFormat = DEFAULT_DATE_SELECTOR_DAY_FORMAT, ...selectorProps },
		ref,
	): React.JSX.Element {
		const labels = React.useMemo((): DateSelectorLabels => ({ ...DEFAULT_DATE_SELECTOR_LABELS, ...labelOverrides }), [labelOverrides]);
		const text = formatDateSelectorValue(selectorProps.value, labels, dayFormat);
		const summary = text === "" ? null : `${labels.filterTypes[selectorProps.value.operator]} ${text}`;
		const renderSheet = React.useCallback(
			(close: () => void): React.JSX.Element => <DateSelectorDraftSheet {...selectorProps} dayFormat={dayFormat} labels={labels} close={close} />,
			[dayFormat, labels, selectorProps],
		);
		return (
			<CalendarField
				ref={ref}
				label={label}
				summary={summary}
				placeholder={placeholder ?? labels.selectDate}
				hint={hint}
				error={error}
				disabled={disabled}
				renderSheet={renderSheet}
				className={className}
				testID={testID}
			/>
		);
	}),
);
