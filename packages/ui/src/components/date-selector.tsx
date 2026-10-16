"use client";

import { Button } from "@workspace/ui/components/button";
import { Calendar } from "@workspace/ui/components/calendar";
import {
	buildYearList,
	DEFAULT_DAY_DATE_FORMAT,
	formatDateValue,
	getMonthPosition,
	isPeriodInRange,
	isYearInPeriodRange,
	parseDateSelectorInput,
	periodKey,
	periodName,
	resolveDayDateFormats,
	type DateSelectorFilterType,
	type DateSelectorPeriodPoint,
	type DateSelectorPeriodType,
	type DateSelectorValue,
} from "@workspace/ui/lib/date-selector/value";
import { Input } from "@workspace/ui/components/input";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { cva } from "class-variance-authority";
import { addMonths, isBefore, subMonths } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, CornerUpLeftIcon, CornerUpRightIcon, XIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";
import { z } from "zod";

export { formatDateValue } from "@workspace/ui/lib/date-selector/value";
export type {
	DateSelectorFilterType,
	DateSelectorPeriodNames,
	DateSelectorPeriodPoint,
	DateSelectorPeriodType,
	DateSelectorValue,
} from "@workspace/ui/lib/date-selector/value";

/** Every string a date selector renders or announces. Arrays are indexed by period (month 0–11, quarter 0–3, half 0–1, weekday 0 = Sunday). */
export interface DateSelectorLabels {
	readonly selectDate: string;
	readonly apply: string;
	readonly cancel: string;
	readonly clear: string;
	readonly today: string;
	readonly previousMonth: string;
	readonly nextMonth: string;
	/** Accessible name of the is / before / after / between tabs. */
	readonly filterTypeGroup: string;
	/** Accessible name of the day / month / quarter / half-year / year tabs. */
	readonly periodTypeGroup: string;
	readonly filterTypes: {
		readonly is: string;
		readonly before: string;
		readonly after: string;
		readonly between: string;
	};
	readonly periodTypes: {
		readonly day: string;
		readonly month: string;
		readonly quarter: string;
		readonly halfYear: string;
		readonly year: string;
	};
	readonly months: readonly string[];
	readonly monthsShort: readonly string[];
	readonly quarters: readonly string[];
	readonly halfYears: readonly string[];
	readonly weekdays: readonly string[];
	readonly weekdaysShort: readonly string[];
	readonly placeholder: string;
	readonly rangePlaceholder: string;
}

/** reui's name for the date selector's copy — the same shape as `DateSelectorLabels`. */
export type DateSelectorI18nConfig = DateSelectorLabels;

export interface DateSelectorContextValue {
	readonly i18n: DateSelectorLabels;
	readonly variant: "outline" | "default";
	readonly size: "sm" | "default" | "lg";
}

const DateSelectorContext = React.createContext<DateSelectorContextValue | null>(null);

/** The surrounding `DateSelector`'s copy and look. Throws outside a `DateSelector`. */
export function useDateSelectorContext(): DateSelectorContextValue {
	const context = React.useContext(DateSelectorContext);
	if (context === null) {
		throw new Error("useDateSelectorContext must be used inside a DateSelector.");
	}
	return context;
}

const DateSelectorFilterTypeSchema = z.enum(["is", "before", "after", "between"]);
const DateSelectorPeriodTypeSchema = z.enum(["day", "month", "quarter", "half-year", "year"]);

type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** reui's hook default: eleven years centred on the current one. */
const HOOK_DEFAULT_YEAR_RANGE = 11;
/** The `DateSelector` default: ten years — though the default `minYear` / `maxYear` window below takes precedence. */
const SELECTOR_DEFAULT_YEAR_RANGE = 10;
/** With no `minYear`, the year lists reach this many years back from `maxYear` (reui: 2015–2026). */
const DEFAULT_YEARS_BACK = 11;
/** A whole year is a period with a single slot. */
const WHOLE_YEAR_SLOT = 0;

// The clock has no event to subscribe to, but a store snapshot is still read
// on every render — so "this year" and "this month" stay current.
function subscribeToClock(): () => void {
	return (): void => undefined;
}

function getCurrentYear(): number {
	return new Date().getFullYear();
}

function clearedValue(value: DateSelectorValue): DateSelectorValue {
	return { period: value.period, operator: value.operator };
}

function withPeriodIndex(value: DateSelectorValue, year: number, index: number): DateSelectorValue {
	switch (value.period) {
		case "month":
			return { ...value, year, month: index };
		case "quarter":
			return { ...value, year, quarter: index };
		case "half-year":
			return { ...value, year, halfYear: index };
		case "day":
		case "year":
			return { ...value, year };
		default:
			return assertNeverPeriodType(value.period);
	}
}

function assertNeverPeriodType(value: never): never {
	throw new Error(`Unhandled date selector period: ${String(value)}`);
}

/** The next range after picking `point`: a fresh start, or the other end (swapped when it comes first). */
function nextPeriodRange(value: DateSelectorValue, point: DateSelectorPeriodPoint): DateSelectorValue {
	const { rangeStart, rangeEnd } = value;
	if (rangeStart === undefined || rangeEnd !== undefined) {
		return { ...value, rangeStart: point, rangeEnd: undefined };
	}
	if (periodKey(point) < periodKey(rangeStart)) {
		return { ...value, rangeStart: point, rangeEnd: rangeStart };
	}
	return { ...value, rangeEnd: point };
}

export interface UseDateSelectorOptions {
	/** Controlled value. Pair with `onChange`. */
	readonly value?: DateSelectorValue | undefined;
	/** Initial value when uncontrolled. */
	readonly defaultValue?: DateSelectorValue | undefined;
	/** Fired with the whole next value after every pick, clear, or period / filter change. */
	readonly onChange?: ((value: DateSelectorValue) => void) | undefined;
	readonly defaultPeriodType?: DateSelectorPeriodType | undefined;
	readonly defaultFilterType?: DateSelectorFilterType | undefined;
	/** Locks the filter operator (the filter tabs are disabled). */
	readonly presetMode?: DateSelectorFilterType | undefined;
	readonly allowRange?: boolean | undefined;
	readonly yearRange?: number | undefined;
	readonly baseYear?: number | undefined;
	readonly minYear?: number | undefined;
	readonly maxYear?: number | undefined;
	readonly periodTypes?: readonly DateSelectorPeriodType[] | undefined;
}

export interface UseDateSelectorResult {
	readonly periodType: DateSelectorPeriodType;
	readonly filterType: DateSelectorFilterType;
	readonly selectedDate: Date | undefined;
	readonly selectedEndDate: Date | undefined;
	readonly calendarMonth: Date;
	readonly selectedYear: number | undefined;
	readonly selectedMonth: number | undefined;
	readonly selectedQuarter: number | undefined;
	readonly selectedHalfYear: number | undefined;
	readonly rangeStart: DateSelectorPeriodPoint | undefined;
	readonly rangeEnd: DateSelectorPeriodPoint | undefined;
	readonly hoverDate: Date | undefined;
	readonly years: readonly number[];
	readonly currentValue: DateSelectorValue;
	readonly allowRange: boolean;
	/** Whether picks build a range (`between` with ranges allowed). */
	readonly isRange: boolean;
	readonly setValue: (value: DateSelectorValue) => void;
	readonly setPeriodType: (type: DateSelectorPeriodType) => void;
	readonly setFilterType: (type: DateSelectorFilterType) => void;
	readonly setCalendarMonth: (month: Date) => void;
	readonly setHoverDate: (date: Date | undefined) => void;
	readonly clearSelection: () => void;
	readonly handleDayClick: (day: Date) => void;
	readonly handlePeriodSelect: (year: number, value: number) => void;
	readonly handleYearSelect: (year: number) => void;
	readonly isInRange: (year: number, value: number) => boolean;
	readonly isYearInRange: (year: number) => boolean;
}

/** The date selector's state machine — controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). */
export function useDateSelector({
	value,
	defaultValue,
	onChange,
	defaultPeriodType = "day",
	defaultFilterType = "is",
	presetMode,
	allowRange = true,
	yearRange = HOOK_DEFAULT_YEAR_RANGE,
	baseYear,
	minYear,
	maxYear,
	periodTypes,
}: UseDateSelectorOptions): UseDateSelectorResult {
	const clockYear = React.useSyncExternalStore(subscribeToClock, getCurrentYear, getCurrentYear);
	const currentYear = baseYear ?? clockYear;

	const validDefaultPeriodType = React.useMemo((): DateSelectorPeriodType => {
		if (periodTypes === undefined || periodTypes.includes(defaultPeriodType)) {
			return defaultPeriodType;
		}
		return periodTypes.at(0) ?? defaultPeriodType;
	}, [periodTypes, defaultPeriodType]);

	const [valueState, setValueState] = React.useState<DateSelectorValue>(
		(): DateSelectorValue => defaultValue ?? { period: validDefaultPeriodType, operator: presetMode ?? defaultFilterType },
	);
	const isControlled = value !== undefined;
	const rawValue = value ?? valueState;
	const currentValue = React.useMemo(
		(): DateSelectorValue => (presetMode === undefined || rawValue.operator === presetMode ? rawValue : { ...rawValue, operator: presetMode }),
		[presetMode, rawValue],
	);

	const [calendarMonth, setCalendarMonth] = React.useState<Date>((): Date => currentValue.startDate ?? new Date());
	const [hoverDate, setHoverDate] = React.useState<Date | undefined>(undefined);

	const isRange = currentValue.operator === "between" && allowRange;

	const setValue = React.useCallback(
		(next: DateSelectorValue): void => {
			if (!isControlled) {
				setValueState(next);
			}
			onChange?.(next);
		},
		[isControlled, onChange],
	);

	const years = React.useMemo((): number[] => buildYearList({ currentYear, yearRange, minYear, maxYear }), [currentYear, yearRange, minYear, maxYear]);

	const clearSelection = React.useCallback((): void => {
		setValue(clearedValue(currentValue));
	}, [currentValue, setValue]);

	const handleDayClick = React.useCallback(
		(day: Date): void => {
			const { startDate, endDate } = currentValue;
			if (!isRange || startDate === undefined || endDate !== undefined) {
				setValue({ ...currentValue, startDate: day, endDate: undefined });
				return;
			}
			if (isBefore(day, startDate)) {
				setValue({ ...currentValue, startDate: day, endDate: startDate });
				return;
			}
			setValue({ ...currentValue, endDate: day });
		},
		[currentValue, isRange, setValue],
	);

	const handlePeriodSelect = React.useCallback(
		(year: number, index: number): void => {
			const point: DateSelectorPeriodPoint = { year, value: index };
			if (!isRange) {
				setValue({ ...withPeriodIndex(currentValue, year, index), rangeStart: undefined, rangeEnd: undefined });
				return;
			}
			const isFreshStart = currentValue.rangeStart === undefined || currentValue.rangeEnd !== undefined;
			setValue(nextPeriodRange(isFreshStart ? withPeriodIndex(currentValue, year, index) : currentValue, point));
		},
		[currentValue, isRange, setValue],
	);

	const handleYearSelect = React.useCallback(
		(year: number): void => {
			if (!isRange) {
				setValue({ ...currentValue, year, rangeStart: undefined, rangeEnd: undefined });
				return;
			}
			const isFreshStart = currentValue.rangeStart === undefined || currentValue.rangeEnd !== undefined;
			setValue(nextPeriodRange(isFreshStart ? { ...currentValue, year } : currentValue, { year, value: WHOLE_YEAR_SLOT }));
		},
		[currentValue, isRange, setValue],
	);

	const setPeriodType = React.useCallback(
		(type: DateSelectorPeriodType): void => {
			setValue(clearedValue({ ...currentValue, period: type }));
		},
		[currentValue, setValue],
	);

	const setFilterType = React.useCallback(
		(type: DateSelectorFilterType): void => {
			if (presetMode !== undefined) {
				return;
			}
			setValue(clearedValue({ ...currentValue, operator: type }));
		},
		[currentValue, presetMode, setValue],
	);

	const { rangeStart, rangeEnd } = currentValue;
	const isInRange = React.useCallback((year: number, index: number): boolean => isPeriodInRange({ year, value: index }, rangeStart, rangeEnd), [rangeStart, rangeEnd]);
	const isYearInRange = React.useCallback((year: number): boolean => isYearInPeriodRange(year, rangeStart, rangeEnd), [rangeStart, rangeEnd]);

	return {
		periodType: currentValue.period,
		filterType: currentValue.operator,
		selectedDate: currentValue.startDate,
		selectedEndDate: currentValue.endDate,
		calendarMonth,
		selectedYear: currentValue.year,
		selectedMonth: currentValue.month,
		selectedQuarter: currentValue.quarter,
		selectedHalfYear: currentValue.halfYear,
		rangeStart,
		rangeEnd,
		hoverDate,
		years,
		currentValue,
		allowRange,
		isRange,
		setValue,
		setPeriodType,
		setFilterType,
		setCalendarMonth,
		setHoverDate,
		clearSelection,
		handleDayClick,
		handlePeriodSelect,
		handleYearSelect,
		isInRange,
		isYearInRange,
	};
}

interface DateSelectorFilterToggleProps {
	readonly value: DateSelectorFilterType;
	readonly onChange: (value: DateSelectorFilterType) => void;
	readonly showBetween: boolean;
	readonly isLocked: boolean;
}

function DateSelectorFilterToggle({ value, onChange, showBetween, isLocked }: DateSelectorFilterToggleProps): React.JSX.Element {
	const { i18n } = useDateSelectorContext();
	const handleValueChange = React.useCallback(
		(next: string | number | null): void => {
			const parsed = DateSelectorFilterTypeSchema.safeParse(next);
			if (!isLocked && parsed.success) {
				onChange(parsed.data);
			}
		},
		[isLocked, onChange],
	);

	return (
		<Tabs value={value} onValueChange={handleValueChange}>
			<TabsList aria-label={i18n.filterTypeGroup} className="bg-muted/80">
				<TabsTrigger value="is" disabled={isLocked} className="py-1 font-normal">
					{i18n.filterTypes.is}
				</TabsTrigger>
				<TabsTrigger value="before" disabled={isLocked} className="py-1 font-normal">
					{i18n.filterTypes.before}
				</TabsTrigger>
				<TabsTrigger value="after" disabled={isLocked} className="py-1 font-normal">
					{i18n.filterTypes.after}
				</TabsTrigger>
				{showBetween ? (
					<TabsTrigger value="between" disabled={isLocked} className="py-1 font-normal">
						{i18n.filterTypes.between}
					</TabsTrigger>
				) : null}
			</TabsList>
		</Tabs>
	);
}

interface PeriodTab {
	readonly value: DateSelectorPeriodType;
	readonly label: string;
}

interface DateSelectorMonthNavigationProps {
	readonly calendarMonth: Date;
	readonly onMonthChange: (month: Date) => void;
}

function DateSelectorMonthNavigation({ calendarMonth, onMonthChange }: DateSelectorMonthNavigationProps): React.JSX.Element {
	const { i18n } = useDateSelectorContext();
	const getCalendarMonthPosition = React.useCallback((): ReturnType<typeof getMonthPosition> => getMonthPosition(calendarMonth, new Date()), [calendarMonth]);
	const monthPosition = React.useSyncExternalStore(subscribeToClock, getCalendarMonthPosition, getCalendarMonthPosition);

	const handleToday = React.useCallback((): void => {
		onMonthChange(new Date());
	}, [onMonthChange]);
	const handlePrevious = React.useCallback((): void => {
		onMonthChange(subMonths(calendarMonth, 1));
	}, [calendarMonth, onMonthChange]);
	const handleNext = React.useCallback((): void => {
		onMonthChange(addMonths(calendarMonth, 1));
	}, [calendarMonth, onMonthChange]);

	return (
		<div className="flex items-center">
			{/* Only off the current month, pointing back to today */}
			{monthPosition === "current" ? null : (
				<Button type="button" variant="ghost" size="icon-sm" onClick={handleToday} title={i18n.today} aria-label={i18n.today}>
					{monthPosition === "future" ? <CornerUpLeftIcon aria-hidden="true" /> : <CornerUpRightIcon aria-hidden="true" />}
				</Button>
			)}
			<Button type="button" variant="ghost" size="icon-sm" onClick={handlePrevious} aria-label={i18n.previousMonth}>
				<ChevronLeftIcon aria-hidden="true" className="size-4 rtl:rotate-180" />
			</Button>
			<Button type="button" variant="ghost" size="icon-sm" onClick={handleNext} aria-label={i18n.nextMonth}>
				<ChevronRightIcon aria-hidden="true" className="size-4 rtl:rotate-180" />
			</Button>
		</div>
	);
}

interface DateSelectorPeriodTabsProps {
	readonly value: DateSelectorPeriodType;
	readonly onChange: (value: DateSelectorPeriodType) => void;
	readonly periodTypes?: readonly DateSelectorPeriodType[] | undefined;
	readonly calendarMonth: Date;
	readonly onMonthChange: (date: Date) => void;
}

function DateSelectorPeriodTabs({ value, onChange, periodTypes, calendarMonth, onMonthChange }: DateSelectorPeriodTabsProps): React.JSX.Element {
	const { i18n } = useDateSelectorContext();
	const tabs = React.useMemo((): readonly PeriodTab[] => {
		const all: readonly PeriodTab[] = [
			{ value: "day", label: i18n.periodTypes.day },
			{ value: "month", label: i18n.periodTypes.month },
			{ value: "quarter", label: i18n.periodTypes.quarter },
			{ value: "half-year", label: i18n.periodTypes.halfYear },
			{ value: "year", label: i18n.periodTypes.year },
		];
		return periodTypes === undefined ? all : all.filter((tab: PeriodTab): boolean => periodTypes.includes(tab.value));
	}, [i18n.periodTypes, periodTypes]);

	const handleValueChange = React.useCallback(
		(next: string | number | null): void => {
			const parsed = DateSelectorPeriodTypeSchema.safeParse(next);
			if (parsed.success) {
				onChange(parsed.data);
			}
		},
		[onChange],
	);

	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<Tabs value={value} onValueChange={handleValueChange}>
				<TabsList aria-label={i18n.periodTypeGroup}>
					{tabs.map((tab: PeriodTab): React.JSX.Element => (
						<TabsTrigger key={tab.value} value={tab.value} className="px-1 py-1 font-normal sm:px-2.5">
							{tab.label}
						</TabsTrigger>
					))}
				</TabsList>
			</Tabs>
			{value === "day" ? <DateSelectorMonthNavigation calendarMonth={calendarMonth} onMonthChange={onMonthChange} /> : null}
		</div>
	);
}

const DAY_PICKER_CLASS_NAMES = {
	months: "flex w-full flex-wrap items-start justify-between gap-5",
	month: "flex min-w-0 flex-1 flex-col items-center",
	nav: "hidden",
};

const SINGLE_MONTH = 1;
const TWO_MONTHS = 2;

interface DateSelectorDayPickerProps {
	readonly currentMonth: Date;
	readonly onMonthChange: (month: Date) => void;
	readonly selectedDate?: Date | undefined;
	readonly selectedEndDate?: Date | undefined;
	readonly onDayClick: (day: Date) => void;
	readonly isRange: boolean;
	readonly onDayHover: (day: Date | undefined) => void;
	readonly hoverDate?: Date | undefined;
	readonly showTwoMonths: boolean;
	readonly weekStartsOn?: WeekStartsOn | undefined;
}

function rangeSelection(selectedDate: Date | undefined, selectedEndDate: Date | undefined, hoverDate: Date | undefined): DateRange | undefined {
	if (selectedDate === undefined) {
		return undefined;
	}
	return { from: selectedDate, to: selectedEndDate ?? hoverDate ?? selectedDate };
}

function DateSelectorDayPicker({
	currentMonth,
	onMonthChange,
	selectedDate,
	selectedEndDate,
	onDayClick,
	isRange,
	onDayHover,
	hoverDate,
	showTwoMonths,
	weekStartsOn,
}: DateSelectorDayPickerProps): React.JSX.Element {
	const { i18n } = useDateSelectorContext();
	const isMobile = useIsMobile();
	const numberOfMonths = !isMobile && showTwoMonths ? TWO_MONTHS : SINGLE_MONTH;

	const formatters = React.useMemo(
		() => ({
			formatWeekdayName: (date: Date): string => {
				const dayIndex = date.getDay();
				return periodName(i18n.weekdaysShort, dayIndex) || periodName(i18n.weekdays, dayIndex);
			},
			formatCaption: (date: Date): string => `${periodName(i18n.months, date.getMonth())} ${String(date.getFullYear())}`,
		}),
		[i18n.months, i18n.weekdays, i18n.weekdaysShort],
	);

	const handleDayClick = React.useCallback(
		(day: Date): void => {
			onDayClick(day);
		},
		[onDayClick],
	);
	const handleDayMouseEnter = React.useCallback(
		(day: Date): void => {
			if (isRange) {
				onDayHover(day);
			}
		},
		[isRange, onDayHover],
	);
	const handleDayMouseLeave = React.useCallback((): void => {
		if (isRange) {
			onDayHover(undefined);
		}
	}, [isRange, onDayHover]);

	const sharedProps = {
		month: currentMonth,
		onMonthChange,
		captionLayout: "label",
		numberOfMonths,
		showOutsideDays: true,
		formatters,
		className: "w-full shrink-0 p-0",
		classNames: DAY_PICKER_CLASS_NAMES,
		onDayClick: handleDayClick,
		onDayMouseEnter: handleDayMouseEnter,
		onDayMouseLeave: handleDayMouseLeave,
		...(weekStartsOn === undefined ? {} : { weekStartsOn }),
	} satisfies Partial<React.ComponentProps<typeof Calendar>>;

	return (
		<div className="flex w-full items-center justify-between">
			{isRange ? (
				<Calendar mode="range" selected={rangeSelection(selectedDate, selectedEndDate, hoverDate)} {...sharedProps} />
			) : (
				<Calendar mode="single" selected={selectedDate} {...sharedProps} />
			)}
		</div>
	);
}

interface DateSelectorPeriodButtonProps {
	readonly year: number;
	readonly index: number;
	readonly label: string;
	readonly isSelected: boolean;
	readonly isInRange: boolean;
	readonly onSelect: (year: number, index: number) => void;
}

function DateSelectorPeriodButton({ year, index, label, isSelected, isInRange, onSelect }: DateSelectorPeriodButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(year, index);
	}, [index, onSelect, year]);

	return (
		<Button
			type="button"
			size="sm"
			variant={isSelected ? "default" : "outline"}
			aria-pressed={isSelected}
			className={cn(isInRange && !isSelected ? "bg-accent dark:bg-accent/60" : undefined)}
			onClick={handleClick}>
			{label}
		</Button>
	);
}

/** Grid column classes per period list (static, so Tailwind sees them). */
type PeriodGridColumns = "grid-cols-2" | "grid-cols-3" | "grid-cols-4";

interface DateSelectorPeriodGridProps {
	readonly years: readonly number[];
	readonly items: readonly string[];
	readonly selectedYear?: number | undefined;
	readonly selectedValue?: number | undefined;
	readonly rangeStart?: DateSelectorPeriodPoint | undefined;
	readonly rangeEnd?: DateSelectorPeriodPoint | undefined;
	readonly isInRange: (year: number, value: number) => boolean;
	readonly onSelect: (year: number, value: number) => void;
	readonly columns: PeriodGridColumns;
}

function DateSelectorPeriodGrid({
	years,
	items,
	selectedYear,
	selectedValue,
	rangeStart,
	rangeEnd,
	isInRange,
	onSelect,
	columns,
}: DateSelectorPeriodGridProps): React.JSX.Element {
	return (
		<div className="w-full space-y-6">
			{years.map((year: number): React.JSX.Element => (
				<div key={year} role="group" aria-label={String(year)}>
					<div className="mb-3 text-sm font-medium text-muted-foreground" aria-hidden="true">
						{year}
					</div>
					<div className={cn("grid gap-2", columns)}>
						{items.map((item: string, index: number): React.JSX.Element => {
							const isSelected =
								(selectedYear === year && selectedValue === index) ||
								(rangeStart?.year === year && rangeStart.value === index) ||
								(rangeEnd?.year === year && rangeEnd.value === index);
							return (
								<DateSelectorPeriodButton key={item} year={year} index={index} label={item} isSelected={isSelected} isInRange={isInRange(year, index)} onSelect={onSelect} />
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}

interface DateSelectorYearButtonProps {
	readonly year: number;
	readonly isSelected: boolean;
	readonly isInRange: boolean;
	readonly onSelect: (year: number) => void;
}

function DateSelectorYearButton({ year, isSelected, isInRange, onSelect }: DateSelectorYearButtonProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(year);
	}, [onSelect, year]);

	return (
		<Button
			type="button"
			size="sm"
			variant={isSelected ? "default" : "outline"}
			aria-pressed={isSelected}
			className={cn(isInRange && !isSelected ? "bg-accent dark:bg-accent/60" : undefined)}
			onClick={handleClick}>
			{year}
		</Button>
	);
}

interface DateSelectorYearListProps {
	readonly years: readonly number[];
	readonly selectedYear?: number | undefined;
	readonly rangeStart?: DateSelectorPeriodPoint | undefined;
	readonly rangeEnd?: DateSelectorPeriodPoint | undefined;
	readonly isYearInRange: (year: number) => boolean;
	readonly onSelect: (year: number) => void;
}

function DateSelectorYearList({ years, selectedYear, rangeStart, rangeEnd, isYearInRange, onSelect }: DateSelectorYearListProps): React.JSX.Element {
	const hasRange = rangeStart !== undefined || rangeEnd !== undefined;
	return (
		<div className="grid grid-cols-2 gap-2">
			{years.map((year: number): React.JSX.Element => (
				<DateSelectorYearButton
					key={year}
					year={year}
					isSelected={(selectedYear === year && !hasRange) || rangeStart?.year === year || rangeEnd?.year === year}
					isInRange={isYearInRange(year)}
					onSelect={onSelect}
				/>
			))}
		</div>
	);
}

const dateSelectorVariants = cva("w-full space-y-4 sm:w-120", {
	variants: {
		state: {
			default: "",
			loading: "pointer-events-none cursor-wait opacity-70",
			disabled: "pointer-events-none opacity-50",
			error: "",
		},
	},
	defaultVariants: {
		state: "default",
	},
});

export interface DateSelectorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue" | "children"> {
	/** Controlled value. Pair with `onChange`. */
	readonly value?: DateSelectorValue | undefined;
	/** Initial value when uncontrolled. */
	readonly defaultValue?: DateSelectorValue | undefined;
	/** Fired with the whole next value after every pick, clear, typed value, or period / filter change. */
	readonly onChange?: ((value: DateSelectorValue) => void) | undefined;
	/** Offers the `between` filter (ranges). */
	readonly allowRange?: boolean | undefined;
	/** The period tabs to offer, in the standard order. */
	readonly periodTypes?: readonly DateSelectorPeriodType[] | undefined;
	readonly defaultPeriodType?: DateSelectorPeriodType | undefined;
	readonly defaultFilterType?: DateSelectorFilterType | undefined;
	/** Locks the filter operator; the filter tabs are disabled. */
	readonly presetMode?: DateSelectorFilterType | undefined;
	/** Shows the text field with the formatted value. */
	readonly showInput?: boolean | undefined;
	/** Shows two months side by side on wide viewports. */
	readonly showTwoMonths?: boolean | undefined;
	/** A heading beside the filter tabs; also the selector's accessible name. */
	readonly label?: string | undefined;
	readonly yearRange?: number | undefined;
	readonly baseYear?: number | undefined;
	/** First year of the period / year lists. Defaults to eleven years before `maxYear`. */
	readonly minYear?: number | undefined;
	/** Last year of the period / year lists. Defaults to the current year. */
	readonly maxYear?: number | undefined;
	/** Overrides some of the `dateSelector` labels from `UiKitLabelsProvider` for this usage. */
	readonly i18n?: Partial<DateSelectorLabels> | undefined;
	/** Makes the text field editable, shown as its placeholder while focused (e.g. "MM/DD/YYYY, Q1 2025, 2025"). */
	readonly inputHint?: string | undefined;
	/** date-fns pattern for days in the text field. */
	readonly dayDateFormat?: string | undefined;
	/** Extra date-fns patterns accepted when a day is typed. */
	readonly dayDateFormats?: readonly string[] | undefined;
	readonly weekStartsOn?: WeekStartsOn | undefined;
	readonly disabled?: boolean | undefined;
	readonly loading?: boolean | undefined;
}

/** A filter-style date picker: is / before / after / between a day, month, quarter, half-year or year. */
const DateSelector = React.forwardRef<HTMLDivElement, DateSelectorProps>(function DateSelector(
	{
		value,
		defaultValue,
		onChange,
		allowRange = true,
		periodTypes,
		defaultPeriodType = "day",
		defaultFilterType = "is",
		presetMode,
		showInput = true,
		showTwoMonths = true,
		label,
		className,
		yearRange = SELECTOR_DEFAULT_YEAR_RANGE,
		baseYear,
		minYear,
		maxYear,
		i18n: i18nOverride,
		inputHint,
		dayDateFormat = DEFAULT_DAY_DATE_FORMAT,
		dayDateFormats,
		weekStartsOn,
		disabled = false,
		loading = false,
		"aria-invalid": ariaInvalid,
		...props
	},
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("dateSelector", i18nOverride);
	const clockYear = React.useSyncExternalStore(subscribeToClock, getCurrentYear, getCurrentYear);
	const resolvedMaxYear = maxYear ?? clockYear;
	const resolvedMinYear = minYear ?? resolvedMaxYear - DEFAULT_YEARS_BACK;

	const selector = useDateSelector({
		value,
		defaultValue,
		onChange,
		defaultPeriodType,
		defaultFilterType,
		presetMode,
		allowRange,
		yearRange,
		baseYear,
		minYear: resolvedMinYear,
		maxYear: resolvedMaxYear,
		periodTypes,
	});
	const {
		periodType,
		filterType,
		selectedDate,
		selectedEndDate,
		calendarMonth,
		selectedYear,
		selectedMonth,
		selectedQuarter,
		selectedHalfYear,
		rangeStart,
		rangeEnd,
		hoverDate,
		years,
		currentValue,
		isRange,
		setValue,
		setPeriodType,
		setFilterType,
		setCalendarMonth,
		setHoverDate,
		clearSelection,
		handleDayClick,
		handlePeriodSelect,
		handleYearSelect,
		isInRange,
		isYearInRange,
	} = selector;

	const state = resolveFieldState({ disabled, loading, ariaInvalid });
	const labelId = React.useId();
	const contextValue = React.useMemo((): DateSelectorContextValue => ({ i18n: labels, variant: "outline", size: "default" }), [labels]);

	const displayValue = formatDateValue(currentValue, labels, dayDateFormat);
	// The text being typed; `null` while the field is not being edited, so it shows the formatted value.
	const [draft, setDraft] = React.useState<string | null>(null);
	const isEditable = inputHint !== undefined;
	const inputValue = isEditable ? (draft ?? displayValue) : displayValue;

	const dateFormats = React.useMemo((): string[] => resolveDayDateFormats(dayDateFormat, dayDateFormats), [dayDateFormat, dayDateFormats]);

	const handleInputFocus = React.useCallback((): void => {
		if (isEditable) {
			setDraft(displayValue);
		}
	}, [displayValue, isEditable]);

	const handleInputBlur = React.useCallback((): void => {
		setDraft(null);
	}, []);

	const handleInputChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const text = event.target.value;
			setDraft(text);
			const parsed = parseDateSelectorInput(text, { operator: presetMode ?? filterType, dateFormats, referenceDate: new Date() });
			if (parsed !== null) {
				setValue(parsed);
			}
		},
		[dateFormats, filterType, presetMode, setValue],
	);

	const handleClear = React.useCallback((): void => {
		setDraft((current: string | null): string | null => (current === null ? null : ""));
		clearSelection();
	}, [clearSelection]);

	const isInteractive = state !== "disabled" && state !== "loading";

	return (
		<DateSelectorContext.Provider value={contextValue}>
			<div
				ref={ref}
				data-slot="date-selector"
				role="group"
				aria-labelledby={label === undefined ? undefined : labelId}
				aria-label={label === undefined ? labels.selectDate : undefined}
				aria-disabled={disabled ? true : undefined}
				aria-busy={loading ? true : undefined}
				data-loading={loading ? "" : undefined}
				inert={!isInteractive}
				className={cn(dateSelectorVariants({ state }), className)}
				{...props}>
				<div className="flex flex-wrap items-center gap-3">
					{label === undefined ? null : (
						<h3 id={labelId} className="text-sm font-medium" data-slot="date-selector-label">
							{label}
						</h3>
					)}
					<DateSelectorFilterToggle value={filterType} onChange={setFilterType} showBetween={allowRange} isLocked={presetMode !== undefined} />
				</div>
				{showInput ? (
					<div className="relative">
						<Input
							type="text"
							value={inputValue}
							readOnly={!isEditable}
							aria-label={label ?? labels.selectDate}
							aria-invalid={ariaInvalid}
							placeholder={draft !== null && isEditable ? inputHint : labels.placeholder}
							className={inputValue === "" ? undefined : "pe-8"}
							onFocus={handleInputFocus}
							onBlur={handleInputBlur}
							onChange={handleInputChange}
						/>
						{inputValue === "" ? null : (
							<button
								type="button"
								onClick={handleClear}
								aria-label={labels.clear}
								className="absolute end-2.5 top-1/2 size-4 -translate-y-1/2 cursor-pointer rounded-xs opacity-70 transition-opacity outline-none hover:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50">
								<XIcon aria-hidden="true" className="size-4" />
							</button>
						)}
					</div>
				) : null}
				<DateSelectorPeriodTabs value={periodType} onChange={setPeriodType} periodTypes={periodTypes} calendarMonth={calendarMonth} onMonthChange={setCalendarMonth} />

				{periodType === "day" ? (
					<div className="w-full pb-1">
						<DateSelectorDayPicker
							currentMonth={calendarMonth}
							onMonthChange={setCalendarMonth}
							selectedDate={selectedDate}
							selectedEndDate={selectedEndDate}
							onDayClick={handleDayClick}
							isRange={isRange}
							onDayHover={setHoverDate}
							hoverDate={hoverDate}
							showTwoMonths={showTwoMonths}
							weekStartsOn={weekStartsOn}
						/>
					</div>
				) : (
					<div className="-me-3 w-full">
						<ScrollArea key={periodType} className="h-50 w-full pe-3">
							{periodType === "month" ? (
								<DateSelectorPeriodGrid
									years={years}
									items={labels.monthsShort}
									selectedYear={selectedYear}
									selectedValue={selectedMonth}
									rangeStart={rangeStart}
									rangeEnd={rangeEnd}
									isInRange={isInRange}
									onSelect={handlePeriodSelect}
									columns="grid-cols-3"
								/>
							) : null}
							{periodType === "quarter" ? (
								<DateSelectorPeriodGrid
									years={years}
									items={labels.quarters}
									selectedYear={selectedYear}
									selectedValue={selectedQuarter}
									rangeStart={rangeStart}
									rangeEnd={rangeEnd}
									isInRange={isInRange}
									onSelect={handlePeriodSelect}
									columns="grid-cols-4"
								/>
							) : null}
							{periodType === "half-year" ? (
								<DateSelectorPeriodGrid
									years={years}
									items={labels.halfYears}
									selectedYear={selectedYear}
									selectedValue={selectedHalfYear}
									rangeStart={rangeStart}
									rangeEnd={rangeEnd}
									isInRange={isInRange}
									onSelect={handlePeriodSelect}
									columns="grid-cols-2"
								/>
							) : null}
							{periodType === "year" ? (
								<DateSelectorYearList
									years={years}
									selectedYear={selectedYear}
									rangeStart={rangeStart}
									rangeEnd={rangeEnd}
									isYearInRange={isYearInRange}
									onSelect={handleYearSelect}
								/>
							) : null}
						</ScrollArea>
					</div>
				)}
			</div>
		</DateSelectorContext.Provider>
	);
});

export { DateSelector, dateSelectorVariants };
