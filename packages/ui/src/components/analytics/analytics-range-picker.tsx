"use client";

import { Calendar } from "@workspace/ui/components/display/calendar";
import { Button } from "@workspace/ui/components/form/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@workspace/ui/components/overlay/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/overlay/popover";
import { formatDateInputString, parseDateInputString } from "@workspace/ui/lib/form/date-input";
import { cn } from "@workspace/ui/lib/core/utils";
import { CalendarRange, ChevronDown } from "lucide-react";
import * as React from "react";
import { addDays } from "date-fns";
import type { DateRange, Matcher } from "react-day-picker";

/** One choice of a menu: its value and what the person reads. */
export interface PickerOption<TValue extends string> {
	readonly value: TValue;
	readonly label: string;
}

/** The control labels — supplied by the caller (no business copy inside the primitive). */
export interface AnalyticsRangePickerLabels {
	readonly range: string;
	/** Label of the custom-days calendar trigger, e.g. "Days". */
	readonly customDays: string;
	/** Shown on the calendar trigger while no day is picked, e.g. "Pick the first and last day". */
	readonly pickDays: string;
	readonly apply: string;
	readonly interval: string;
}

/** The custom days being edited (`YYYY-MM-DD`, inclusive; `""` = not picked yet). */
export interface CustomDays {
	readonly from: string;
	readonly to: string;
}

export interface AnalyticsRangePickerProps<TPreset extends string, TInterval extends string> extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "onChange"> {
	readonly ref?: React.Ref<HTMLDivElement>;
	readonly presets: readonly PickerOption<TPreset>[];
	readonly preset: TPreset;
	/** The preset that reveals the custom days. */
	readonly customPreset: TPreset;
	readonly onPresetChange: (preset: TPreset) => void;
	readonly customDays: CustomDays;
	/** The person picked days in the calendar (a first click sets `from` only). */
	readonly onCustomDaysChange: (days: CustomDays) => void;
	/** Commits the custom days; disabled while `customError` is set. */
	readonly onCustomApply: () => void;
	/** Why the custom days cannot be applied (too long, reversed, missing) — shown under the calendar trigger. */
	readonly customError?: string | undefined;
	/** The latest selectable day (`YYYY-MM-DD`, e.g. today in the report's zone); later days are disabled. */
	readonly customMax?: string | undefined;
	/** The longest range, in days (both ends included), the calendar lets the person select. */
	readonly customMaxDays?: number | undefined;
	/** Formats the picked days for the calendar trigger (the caller owns locale and zone). */
	readonly formatCustomDays: (days: CustomDays) => string;
	readonly intervals: readonly PickerOption<TInterval>[];
	readonly interval: TInterval;
	readonly onIntervalChange: (interval: TInterval) => void;
	/** The range in effect, written out (e.g. "6 Sep – 5 Oct 2026 · UTC") — announced when it changes. */
	readonly rangeLabel: string;
	readonly labels: AnalyticsRangePickerLabels;
	readonly disabled?: boolean;
}

function findOption<TValue extends string>(options: readonly PickerOption<TValue>[], raw: string): PickerOption<TValue> | undefined {
	return options.find((option) => option.value === raw);
}

interface OptionMenuProps<TValue extends string> {
	readonly id: string;
	readonly label: string;
	readonly options: readonly PickerOption<TValue>[];
	readonly value: TValue;
	readonly onChange: (value: TValue) => void;
	readonly disabled: boolean;
	readonly className?: string;
}

/**
 * A labelled single choice: the shared DropdownMenu with a radio group. The
 * trigger is named by the visible label AND the current choice ("Date range,
 * Last 30 days"); the primitive supplies `aria-haspopup` / `aria-expanded`,
 * arrow-key navigation, type-ahead and Escape.
 */
function OptionMenu<TValue extends string>({ id, label, options, value, onChange, disabled, className }: OptionMenuProps<TValue>): React.JSX.Element {
	const labelId = `${id}-label`;
	const valueId = `${id}-value`;
	const current = findOption(options, value);
	const handleValueChange = React.useCallback(
		(raw: string): void => {
			const next = findOption(options, raw);
			if (next !== undefined) {
				onChange(next.value);
			}
		},
		[onChange, options],
	);
	return (
		<div className="flex flex-col gap-1.5">
			<span id={labelId} className="text-xs font-medium text-muted-foreground">
				{label}
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger
					id={id}
					disabled={disabled}
					aria-labelledby={`${labelId} ${valueId}`}
					render={<Button type="button" variant="outline" className={cn("justify-between gap-2 font-normal", className)} />}>
					<span id={valueId}>{current?.label ?? value}</span>
					<ChevronDown className="size-4 opacity-60" aria-hidden="true" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-auto min-w-(--anchor-width)">
					<DropdownMenuRadioGroup value={value} onValueChange={handleValueChange}>
						{options.map((option) => (
							<DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
								{option.label}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

/**
 * The one filter row of an analytics dashboard: a date-range preset (with
 * custom days picked in the shared Calendar — range mode, later days and
 * longer spans disabled — that the caller validates and commits with Apply),
 * the bucket interval, and the range in effect as text. Fully controlled;
 * built only from the shared menu, popover, calendar and button primitives.
 */
export function AnalyticsRangePicker<TPreset extends string, TInterval extends string>({
	ref,
	presets,
	preset,
	customPreset,
	onPresetChange,
	customDays,
	onCustomDaysChange,
	onCustomApply,
	customError,
	customMax,
	customMaxDays,
	formatCustomDays,
	intervals,
	interval,
	onIntervalChange,
	rangeLabel,
	labels,
	disabled = false,
	className,
	...props
}: AnalyticsRangePickerProps<TPreset, TInterval>): React.JSX.Element {
	const id = React.useId();
	const daysLabelId = `${id}-days-label`;
	const daysValueId = `${id}-days-value`;
	const errorId = `${id}-error`;
	const isCustom = preset === customPreset;
	const hasError = customError !== undefined;
	const [isCalendarOpen, setCalendarOpen] = React.useState(false);

	const selected = React.useMemo((): DateRange | undefined => {
		const from = parseDateInputString(customDays.from);
		return from === undefined ? undefined : { from, to: parseDateInputString(customDays.to) };
	}, [customDays.from, customDays.to]);
	const latest = customMax === undefined ? undefined : parseDateInputString(customMax);
	// While the second end is being picked, days that would make the span too long are disabled too.
	const disabledDays = React.useMemo((): Matcher[] => {
		const matchers: Matcher[] = latest === undefined ? [] : [{ after: latest }];
		if (customMaxDays !== undefined && selected?.from !== undefined && selected.to === undefined) {
			matchers.push({ after: addDays(selected.from, customMaxDays - 1) }, { before: addDays(selected.from, 1 - customMaxDays) });
		}
		return matchers;
	}, [customMaxDays, latest, selected]);
	const isPicked = selected !== undefined;

	const handleSelect = React.useCallback(
		(range: DateRange | undefined): void => {
			onCustomDaysChange({
				from: range?.from === undefined ? "" : formatDateInputString(range.from),
				to: range?.to === undefined ? "" : formatDateInputString(range.to),
			});
		},
		[onCustomDaysChange],
	);
	const handleSubmit = React.useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			if (!hasError) {
				setCalendarOpen(false);
				onCustomApply();
			}
		},
		[hasError, onCustomApply],
	);

	return (
		<div ref={ref} className={cn("flex flex-col gap-3", className)} {...props}>
			<div className="flex flex-wrap items-end gap-3">
				<OptionMenu id={`${id}-preset`} label={labels.range} options={presets} value={preset} onChange={onPresetChange} disabled={disabled} className="min-w-44" />
				<OptionMenu id={`${id}-interval`} label={labels.interval} options={intervals} value={interval} onChange={onIntervalChange} disabled={disabled} className="min-w-28" />
				<p role="status" aria-live="polite" className="flex items-center gap-1.5 pb-2 text-sm text-muted-foreground">
					<CalendarRange className="size-4 shrink-0" aria-hidden="true" />
					{rangeLabel}
				</p>
			</div>
			{isCustom ? (
				<form onSubmit={handleSubmit} noValidate className="flex flex-wrap items-end gap-3">
					<div className="flex flex-col gap-1.5">
						<span id={daysLabelId} className="text-xs font-medium text-muted-foreground">
							{labels.customDays}
						</span>
						<Popover open={isCalendarOpen} onOpenChange={setCalendarOpen}>
							<PopoverTrigger
								disabled={disabled}
								aria-labelledby={`${daysLabelId} ${daysValueId}`}
								aria-describedby={hasError ? errorId : undefined}
								aria-invalid={hasError}
								render={<Button type="button" variant="outline" className={cn("min-w-56 justify-between gap-2 font-normal", !isPicked && "text-muted-foreground")} />}>
								<span id={daysValueId}>{isPicked ? formatCustomDays(customDays) : labels.pickDays}</span>
								<CalendarRange className="size-4 opacity-60" aria-hidden="true" />
							</PopoverTrigger>
							<PopoverContent align="start" className="w-auto p-0">
								<Calendar
									mode="range"
									selected={selected}
									onSelect={handleSelect}
									resetOnSelect
									excludeDisabled
									disabled={disabledDays}
									{...(latest === undefined ? {} : { endMonth: latest })}
									{...(selected?.from === undefined ? {} : { defaultMonth: selected.from })}
								/>
							</PopoverContent>
						</Popover>
					</div>
					<Button type="submit" variant="outline" disabled={disabled || hasError}>
						{labels.apply}
					</Button>
					{hasError ? (
						<p id={errorId} role="alert" className="basis-full text-sm text-destructive">
							{customError}
						</p>
					) : null}
				</form>
			) : null}
		</div>
	);
}
