"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { parseOptionalDate, useCalendarBounds } from "@workspace/ui/lib/form/calendar-bounds";
import { formatDateInputString } from "@workspace/ui/lib/form/date-input";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { inputVariants } from "@workspace/ui/lib/form/field-variants";
import { cn } from "@workspace/ui/lib/core/utils";
import type { VariantProps } from "class-variance-authority";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

/** date-fns pattern for each picked day on the trigger when no `formatDate` is supplied (medium localized date, e.g. "Sep 4, 2026"). */
const DEFAULT_DISPLAY_FORMAT = "PP";
/** Joins the picked days on the trigger. */
const DISPLAY_SEPARATOR = ", ";

function formatDisplayDate(date: Date): string {
	return format(date, DEFAULT_DISPLAY_FORMAT);
}

const NO_DATES: readonly string[] = [];

interface CalendarMultiSelectionProps {
	readonly defaultMonth?: Date;
	readonly max?: number;
}

/** The picked `yyyy-MM-dd` strings as calendar dates, unparseable ones dropped. */
function parseDates(values: readonly string[]): Date[] {
	return values.flatMap((value: string): Date[] => {
		const date = parseOptionalDate(value);
		return date === undefined ? [] : [date];
	});
}

/** The calendar's selection as `yyyy-MM-dd` strings, in date order without repeats (the strings sort as dates). */
function toDateStrings(dates: readonly Date[] | undefined): readonly string[] {
	return [...new Set((dates ?? []).map((date: Date): string => formatDateInputString(date)))].sort();
}

export interface MultiDatePickerProps extends VariantProps<typeof inputVariants> {
	readonly id?: string;
	/** Submitted as one `name=yyyy-MM-dd` entry per picked day. */
	readonly name?: string;
	/** Controlled `yyyy-MM-dd` values. Pair with `onValueChange`. */
	readonly value?: readonly string[];
	/** Initial `yyyy-MM-dd` values when uncontrolled. */
	readonly defaultValue?: readonly string[];
	/** Shown on the trigger while no date is picked — supplied by the caller (i18n). */
	readonly placeholder?: string;
	readonly disabled?: boolean;
	readonly loading?: boolean;
	readonly className?: string;
	/** Styles the trigger as invalid. A button cannot carry `aria-invalid`, so link the error text with `ariaDescribedBy`. */
	readonly ariaInvalid?: boolean | "true" | "false" | "grammar" | "spelling";
	/** Id(s) of the element(s) describing the field — its hint and, when invalid, its error message. */
	readonly ariaDescribedBy?: string;
	readonly fromDate?: string;
	readonly toDate?: string;
	/** The most days that can be picked; once reached, only picked days can be clicked (to unpick). No limit when absent. */
	readonly maxDates?: number;
	/** Formats each picked day for the trigger label (locale-aware callers pass their own). Defaults to date-fns `PP`. */
	readonly formatDate?: (date: Date) => string;
	/** Controlled popover state. Pair with `onOpenChange`; omit both for the uncontrolled popover. */
	readonly open?: boolean;
	/** Initial popover state when uncontrolled. */
	readonly defaultOpen?: boolean;
	/** Fired whenever the popover opens or closes. It stays open while days are picked; it closes on Escape or a click outside. */
	readonly onOpenChange?: (open: boolean) => void;
	/** Fired with every pick or unpick: all picked days, in date order. */
	readonly onValueChange?: (value: readonly string[]) => void;
	readonly onBlur?: React.FocusEventHandler<HTMLButtonElement>;
	readonly onFocus?: React.FocusEventHandler<HTMLButtonElement>;
}

/** Picks any number of separate days (Sep 4, Sep 14, Oct 3) on one calendar: each click picks or unpicks a day. */
const MultiDatePicker = React.forwardRef<HTMLButtonElement, MultiDatePickerProps>(function MultiDatePicker(
	{
		id,
		name,
		value: valueProp,
		defaultValue = NO_DATES,
		placeholder,
		disabled = false,
		loading = false,
		className,
		variant,
		size,
		ariaInvalid,
		ariaDescribedBy,
		fromDate,
		toDate,
		maxDates,
		formatDate = formatDisplayDate,
		open: openProp,
		defaultOpen = false,
		onOpenChange,
		onValueChange,
		onBlur,
		onFocus,
	},
	ref,
): React.JSX.Element {
	const [openState, setOpenState] = React.useState(defaultOpen);
	const isOpenControlled = openProp !== undefined;
	const open = isOpenControlled ? openProp : openState;

	const [valueState, setValueState] = React.useState<readonly string[]>(defaultValue);
	const isValueControlled = valueProp !== undefined;
	const value = isValueControlled ? valueProp : valueState;

	const selectedDates = React.useMemo(() => parseDates(value), [value]);
	const { boundsProps, isDateDisabled } = useCalendarBounds(fromDate, toDate);
	const state = resolveFieldState({ disabled, loading, ariaInvalid });
	const summary = selectedDates.map((date: Date): string => formatDate(date)).join(DISPLAY_SEPARATOR);
	// Opens on the first picked day's month; `defaultMonth` / `max` cannot be
	// `undefined` under exactOptionalPropertyTypes, so each is omitted when unset.
	const [firstSelected] = selectedDates;
	const selectionProps = React.useMemo<CalendarMultiSelectionProps>(
		() => ({ ...(firstSelected === undefined ? {} : { defaultMonth: firstSelected }), ...(maxDates === undefined ? {} : { max: maxDates }) }),
		[firstSelected, maxDates],
	);

	// At the cap, the unpicked days are disabled too, so the limit shows on the calendar and only unpicking is offered.
	const isFull = maxDates !== undefined && value.length >= maxDates;
	const isDayDisabled = React.useCallback(
		(date: Date): boolean => isDateDisabled(date) || (isFull && !value.includes(formatDateInputString(date))),
		[isDateDisabled, isFull, value],
	);

	const handleOpenChange = React.useCallback(
		(nextOpen: boolean): void => {
			if (!isOpenControlled) {
				setOpenState(nextOpen);
			}
			onOpenChange?.(nextOpen);
		},
		[isOpenControlled, onOpenChange],
	);

	const handleSelect = React.useCallback(
		(dates: Date[] | undefined): void => {
			const nextValue = toDateStrings(dates);
			if (!isValueControlled) {
				setValueState(nextValue);
			}
			onValueChange?.(nextValue);
		},
		[isValueControlled, onValueChange],
	);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger
				ref={ref}
				disabled={disabled || loading}
				render={
					<button
						type="button"
						id={id}
						onBlur={onBlur}
						onFocus={onFocus}
						aria-describedby={ariaDescribedBy}
						data-loading={loading ? "" : undefined}
						className={cn(
							inputVariants({ variant, size, state }),
							"flex w-full items-center justify-between gap-2 text-left font-normal",
							selectedDates.length === 0 ? "text-muted-foreground" : "text-foreground",
							className,
						)}>
						<span className="truncate">{selectedDates.length === 0 ? placeholder : summary}</span>
						<CalendarIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
					</button>
				}
			/>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar mode="multiple" selected={selectedDates} onSelect={handleSelect} disabled={isDayDisabled} {...boundsProps} {...selectionProps} />
			</PopoverContent>
			{name === undefined ? null : value.map((day: string): React.JSX.Element => <input key={day} type="hidden" name={name} value={day} readOnly />)}
		</Popover>
	);
});

export { MultiDatePicker };
