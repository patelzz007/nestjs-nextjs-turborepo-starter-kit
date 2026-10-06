"use client";

import { Calendar } from "@workspace/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { formatDateInputString, parseDateInputString } from "@workspace/ui/lib/form/date-input";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { inputVariants } from "@workspace/ui/lib/form/field-variants";
import { cn } from "@workspace/ui/lib/core/utils";
import type { VariantProps } from "class-variance-authority";
import { format, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

/** date-fns pattern for the trigger label when no `formatDate` is supplied (long localized date, e.g. "April 29th, 2026"). */
const DEFAULT_DISPLAY_FORMAT = "PPP";

function formatDisplayDate(date: Date): string {
	return format(date, DEFAULT_DISPLAY_FORMAT);
}

interface CalendarSelectionProps {
	readonly selected?: Date;
	readonly defaultMonth?: Date;
}

const NO_SELECTION: CalendarSelectionProps = {};

/** Parses an optional `yyyy-MM-dd` prop; empty/absent/invalid strings yield `undefined`. */
function parseOptionalDate(value: string | undefined): Date | undefined {
	return value !== undefined && value.length > 0 ? parseDateInputString(value) : undefined;
}

export interface DatePickerProps extends VariantProps<typeof inputVariants> {
	readonly id?: string;
	readonly name?: string;
	/** Controlled `yyyy-MM-dd` value. Pair with `onValueChange`. */
	readonly value?: string;
	/** Initial `yyyy-MM-dd` value when uncontrolled. */
	readonly defaultValue?: string;
	/** Shown on the trigger while no date is selected — supplied by the caller (i18n). */
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
	/** Formats the selected date for the trigger label (locale-aware callers pass their own). Defaults to date-fns `PPP`. */
	readonly formatDate?: (date: Date) => string;
	/** Controlled popover state. Pair with `onOpenChange`; omit both for the uncontrolled popover. */
	readonly open?: boolean;
	/** Initial popover state when uncontrolled. */
	readonly defaultOpen?: boolean;
	/** Fired whenever the popover opens or closes (including after a date is picked). */
	readonly onOpenChange?: (open: boolean) => void;
	readonly onValueChange?: (value: string) => void;
	readonly onBlur?: React.FocusEventHandler<HTMLButtonElement>;
	readonly onFocus?: React.FocusEventHandler<HTMLButtonElement>;
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
	{
		id,
		name,
		value: valueProp,
		defaultValue,
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

	const [valueState, setValueState] = React.useState(defaultValue);
	const isValueControlled = valueProp !== undefined;
	const value = isValueControlled ? valueProp : valueState;

	const selectedDate = React.useMemo(() => parseOptionalDate(value), [value]);
	const minDate = React.useMemo(() => parseOptionalDate(fromDate), [fromDate]);
	const maxDate = React.useMemo(() => parseOptionalDate(toDate), [toDate]);
	const state = resolveFieldState({ disabled, loading, ariaInvalid });
	// `defaultMonth` cannot be `undefined` under exactOptionalPropertyTypes, so
	// the pair is omitted entirely when nothing is selected (memoised: stable identity).
	const selectionProps = React.useMemo<CalendarSelectionProps>(
		() => (selectedDate === undefined ? NO_SELECTION : { selected: selectedDate, defaultMonth: selectedDate }),
		[selectedDate],
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
		(date: Date | undefined): void => {
			if (date === undefined) {
				return;
			}
			const nextValue = formatDateInputString(date);
			if (!isValueControlled) {
				setValueState(nextValue);
			}
			onValueChange?.(nextValue);
			handleOpenChange(false);
		},
		[handleOpenChange, isValueControlled, onValueChange],
	);

	const isDateDisabled = React.useCallback(
		(date: Date): boolean => {
			const day = startOfDay(date);
			if (minDate !== undefined && day < startOfDay(minDate)) {
				return true;
			}
			if (maxDate !== undefined && day > startOfDay(maxDate)) {
				return true;
			}
			return false;
		},
		[minDate, maxDate],
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
							selectedDate === undefined ? "text-muted-foreground" : "text-foreground",
							className,
						)}>
						<span className="truncate">{selectedDate !== undefined ? formatDate(selectedDate) : placeholder}</span>
						<CalendarIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
					</button>
				}
			/>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar mode="single" onSelect={handleSelect} disabled={isDateDisabled} {...selectionProps} />
			</PopoverContent>
			{name !== undefined ? <input type="hidden" name={name} value={value ?? ""} readOnly /> : null}
		</Popover>
	);
});

export { DatePicker };
