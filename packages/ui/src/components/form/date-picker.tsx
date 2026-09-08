"use client";

import { Calendar } from "@workspace/ui/components/display/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/overlay/popover";
import { formatDateInputString, parseDateInputString } from "@workspace/ui/lib/date-input";
import { resolveFieldState } from "@workspace/ui/lib/field-state";
import { inputVariants } from "@workspace/ui/lib/field-variants";
import { cn } from "@workspace/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { format, startOfDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

export interface DatePickerProps extends VariantProps<typeof inputVariants> {
	readonly id?: string;
	readonly name?: string;
	readonly value?: string;
	readonly placeholder?: string;
	readonly disabled?: boolean;
	readonly loading?: boolean;
	readonly className?: string;
	readonly ariaInvalid?: boolean | "true" | "false" | "grammar" | "spelling";
	readonly fromDate?: string;
	readonly toDate?: string;
	readonly onValueChange?: (value: string) => void;
	readonly onBlur?: React.FocusEventHandler<HTMLButtonElement>;
	readonly onFocus?: React.FocusEventHandler<HTMLButtonElement>;
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
	{ id, name, value, placeholder = "Pick a date", disabled = false, loading = false, className, variant, size, ariaInvalid, fromDate, toDate, onValueChange, onBlur, onFocus },
	ref,
): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const selectedDate = value !== undefined && value.length > 0 ? parseDateInputString(value) : undefined;
	const minDate = fromDate !== undefined && fromDate.length > 0 ? parseDateInputString(fromDate) : undefined;
	const maxDate = toDate !== undefined && toDate.length > 0 ? parseDateInputString(toDate) : undefined;
	const state = resolveFieldState({ disabled, loading, ariaInvalid });

	const handleSelect = React.useCallback(
		(date: Date | undefined): void => {
			if (date === undefined) {
				return;
			}
			onValueChange?.(formatDateInputString(date));
			setOpen(false);
		},
		[onValueChange],
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
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				ref={ref}
				disabled={disabled || loading}
				render={
					<button
						type="button"
						id={id}
						onBlur={onBlur}
						onFocus={onFocus}
						aria-invalid={ariaInvalid}
						className={cn(
							inputVariants({ variant, size, state }),
							"flex w-full items-center justify-between gap-2 text-left font-normal",
							selectedDate === undefined ? "text-muted-foreground" : "text-foreground",
							className,
						)}>
						<span className="truncate">{selectedDate !== undefined ? format(selectedDate, "PPP") : placeholder}</span>
						<CalendarIcon className="size-4 shrink-0 opacity-50" aria-hidden="true" />
					</button>
				}
			/>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar mode="single" selected={selectedDate} onSelect={handleSelect} disabled={isDateDisabled} defaultMonth={selectedDate} />
			</PopoverContent>
			{name !== undefined ? <input type="hidden" name={name} value={value ?? ""} readOnly /> : null}
		</Popover>
	);
});

export { DatePicker };
