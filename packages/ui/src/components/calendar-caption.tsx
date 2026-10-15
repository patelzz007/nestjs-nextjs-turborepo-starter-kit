"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/core/utils";
import { addMonths, endOfMonth, setMonth, setYear, startOfMonth } from "date-fns";
import * as React from "react";
import { useDayPicker, type MonthCaptionProps } from "react-day-picker";

/** The twelve month indexes of a year (`Date#getMonth`: 0 = January). */
const MONTHS_PER_YEAR = 12;
const MONTH_INDEXES: readonly number[] = [...Array<number>(MONTHS_PER_YEAR).keys()];

/** A dropdown option: the Select's string value and label, and the number it stands for. */
interface CaptionOption extends SelectOption<string> {
	readonly number: number;
	readonly disabled: boolean;
}

/** `date`, moved into `first`…`last` (each compared by month). */
function clampMonth(date: Date, first: Date, last: Date): Date {
	if (startOfMonth(date) < startOfMonth(first)) {
		return startOfMonth(first);
	}
	return startOfMonth(date) > startOfMonth(last) ? startOfMonth(last) : date;
}

export interface CalendarCaptionDropdownsProps extends MonthCaptionProps {
	/** Show the month as a dropdown (otherwise as text). */
	readonly showMonths: boolean;
	/** Show the year as a dropdown (otherwise as text). */
	readonly showYears: boolean;
}

/**
 * The calendar caption with the month and year as the UI kit's `Select`
 * (base-ui) instead of react-day-picker's native `<select>`s: the same
 * popover, items and keyboard behaviour as every other select in the apps.
 * The options come from the calendar's `startMonth`…`endMonth` (months
 * outside them are disabled); the names and accessible labels come from the
 * calendar's own formatters and labels, so `locale` and `labels` still apply.
 * Choosing moves the calendar with `goToMonth`; a year whose shown month is
 * out of range lands on the nearest month in range.
 */
export function CalendarCaptionDropdowns({ calendarMonth, displayIndex, showMonths, showYears, className, ...divProps }: CalendarCaptionDropdownsProps): React.JSX.Element {
	const { goToMonth, dayPickerProps, formatters, labels } = useDayPicker();
	const shown = calendarMonth.date;
	const { startMonth, endMonth, disableNavigation } = dayPickerProps;
	const first = startMonth ?? shown;
	const last = endMonth ?? shown;

	const monthOptions = React.useMemo(
		(): readonly CaptionOption[] =>
			MONTH_INDEXES.map((index: number): CaptionOption => {
				const month = setMonth(startOfMonth(shown), index);
				return {
					value: String(index),
					label: formatters.formatMonthDropdown(month),
					number: index,
					disabled: endOfMonth(month) < startOfMonth(first) || month > endOfMonth(last),
				};
			}),
		[first, formatters, last, shown],
	);
	const yearOptions = React.useMemo(
		(): readonly CaptionOption[] =>
			[...Array<number>(Math.max(last.getFullYear() - first.getFullYear() + 1, 0)).keys()].map((offset: number): CaptionOption => {
				const year = first.getFullYear() + offset;
				return { value: String(year), label: formatters.formatYearDropdown(setYear(startOfMonth(shown), year)), number: year, disabled: false };
			}),
		[first, formatters, last, shown],
	);

	/** Shows `month` in this caption's place (a caption past the first is `displayIndex` months on). */
	const show = React.useCallback(
		(month: Date): void => {
			goToMonth(addMonths(startOfMonth(clampMonth(month, first, last)), -displayIndex));
		},
		[displayIndex, first, goToMonth, last],
	);
	const handleMonthChange = React.useCallback(
		(value: string | null): void => {
			const option = monthOptions.find((candidate: CaptionOption): boolean => candidate.value === value);
			if (option !== undefined) {
				show(setMonth(shown, option.number));
			}
		},
		[monthOptions, show, shown],
	);
	const handleYearChange = React.useCallback(
		(value: string | null): void => {
			const option = yearOptions.find((candidate: CaptionOption): boolean => candidate.value === value);
			if (option !== undefined) {
				show(setYear(shown, option.number));
			}
		},
		[show, shown, yearOptions],
	);

	const isDisabled = disableNavigation === true;
	return (
		<div className={className} {...divProps}>
			<div data-slot="calendar-caption-dropdowns" className="flex items-center justify-center gap-1.5">
				{showMonths ? (
					<CaptionSelect
						ariaLabel={labels.labelMonthDropdown()}
						options={monthOptions}
						value={String(shown.getMonth())}
						disabled={isDisabled}
						onValueChange={handleMonthChange}
					/>
				) : (
					<span className="text-sm font-medium">{formatters.formatMonthDropdown(shown)}</span>
				)}
				{showYears ? (
					<CaptionSelect
						ariaLabel={labels.labelYearDropdown()}
						options={yearOptions}
						value={String(shown.getFullYear())}
						disabled={isDisabled}
						onValueChange={handleYearChange}
					/>
				) : (
					<span className="text-sm font-medium">{formatters.formatYearDropdown(shown)}</span>
				)}
			</div>
		</div>
	);
}

interface CaptionSelectProps {
	readonly ariaLabel: string;
	readonly options: readonly CaptionOption[];
	readonly value: string;
	readonly disabled: boolean;
	readonly onValueChange: (value: string | null) => void;
}

function CaptionSelect({ ariaLabel, options, value, disabled, onValueChange }: CaptionSelectProps): React.JSX.Element {
	return (
		<Select items={options} value={value} onValueChange={onValueChange} ariaLabel={ariaLabel} size="sm" disabled={disabled}>
			<SelectTrigger fullWidth={false} className={cn("h-(--cell-size) gap-1 border-transparent bg-transparent px-2 font-medium shadow-none hover:bg-accent")}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent className="max-h-72">
				{options.map((option: CaptionOption): React.JSX.Element => (
					<SelectItem key={option.value} value={option.value} disabled={option.disabled}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
