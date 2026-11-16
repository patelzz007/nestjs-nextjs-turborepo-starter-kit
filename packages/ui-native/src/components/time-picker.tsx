// A time of day (the web kit's `TimePicker`): columns of hours, minutes,
// optional seconds and, on a 12-hour clock, AM/PM — each a short scrolling
// list where the picked cell is filled. `TimePickerPanel` is the columns on
// their own, for a screen or a card; `TimePicker` is a field that opens them
// in a bottom sheet, its picks committed at once, or held as a draft until
// Done with `confirm`. The value is "HH:mm" (or "HH:mm:ss" with seconds), on
// a 24-hour clock whatever is shown; `null` while nothing is picked.
//
// `minuteStep` thins the minutes, `min` / `max` bound the day, and
// `isTimeDisabled` greys out any other slot (booked, lunch); a whole hour
// with no free minute is greyed too. Controlled: `value` in, `onChange` out.
// Copy (AM/PM, the sheet's buttons) is overridable through `labels`, and
// `formatTime` writes the value in the field.

import { cva } from "class-variance-authority";
import ClockIcon from "lucide-react-native/icons/clock";
import * as React from "react";
import { Pressable, ScrollView, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { BottomSheet } from "./bottom-sheet";
import { Button } from "./button";
import { useFieldContext } from "./field";
import { SelectTrigger, type SelectSize } from "./select-field";

export const timePickerColumnCellVariants = cva("min-h-11 items-center justify-center rounded-md px-3", {
	variants: {
		picked: { true: "bg-primary", false: "active:bg-surface-selected" },
		disabled: { true: "opacity-40", false: "" },
	},
	defaultVariants: { picked: false, disabled: false },
});

export const timePickerColumnTextVariants = cva("text-body-lg font-sans tabular-nums", {
	variants: { picked: { true: "text-primary-foreground", false: "text-foreground" } },
	defaultVariants: { picked: false },
});

/** A time of day: 0–23 hours, 0–59 minutes and seconds. */
export interface TimeOfDay {
	readonly hours: number;
	readonly minutes: number;
	readonly seconds: number;
}

export type HourCycle = 12 | 24;
export type TimePickerSize = SelectSize;
export type DayPeriod = "am" | "pm";

const HOURS_PER_DAY = 24;
const HALF_DAY = 12;
const MINUTES_PER_HOUR = 60;
const TWO_DIGITS = 2;
const TIME_PATTERN = /^(?<hours>\d{1,2}):(?<minutes>\d{2})(?::(?<seconds>\d{2}))?$/u;
const TYPED_PATTERN = /^(?<hours>\d{1,2})(?:[:.]?(?<minutes>\d{2}))?(?::(?<seconds>\d{2}))?\s*(?<period>[ap])?\.?m?\.?$/iu;

function pad(value: number): string {
	return String(value).padStart(TWO_DIGITS, "0");
}

/** "14:05" or "14:05:30" → its parts; `null` for anything else. */
export function parseTime(value: string | null): TimeOfDay | null {
	const groups = value === null ? undefined : TIME_PATTERN.exec(value)?.groups;
	if (groups === undefined) {
		return null;
	}
	const time = { hours: Number(groups.hours), minutes: Number(groups.minutes), seconds: Number(groups.seconds ?? "0") };
	return time.hours < HOURS_PER_DAY && time.minutes < MINUTES_PER_HOUR && time.seconds < MINUTES_PER_HOUR ? time : null;
}

/** Its parts → "14:05", or "14:05:30" with seconds. */
export function formatTimeValue(time: TimeOfDay, withSeconds: boolean): string {
	const base = `${pad(time.hours)}:${pad(time.minutes)}`;
	return withSeconds ? `${base}:${pad(time.seconds)}` : base;
}

/** A typed time ("2:30 pm", "1430", "9") → "HH:mm", or `null` when it is not one. */
export function parseTypedTime(text: string, withSeconds = false): string | null {
	const groups = TYPED_PATTERN.exec(text.trim())?.groups;
	if (groups === undefined) {
		return null;
	}
	let hours = Number(groups.hours);
	const period = groups.period?.toLowerCase();
	if (period !== undefined) {
		if (hours < 1 || hours > HALF_DAY) {
			return null;
		}
		hours = (hours % HALF_DAY) + (period === "p" ? HALF_DAY : 0);
	}
	const time = { hours, minutes: Number(groups.minutes ?? "0"), seconds: Number(groups.seconds ?? "0") };
	if (time.hours >= HOURS_PER_DAY || time.minutes >= MINUTES_PER_HOUR || time.seconds >= MINUTES_PER_HOUR) {
		return null;
	}
	return formatTimeValue(time, withSeconds);
}

/** The time as a clock shows it: "2:05 PM" on 12 hours, "14:05" on 24. */
export function displayTime(value: string, hourCycle: HourCycle, periods: TimePickerLabels["periods"] = DEFAULT_TIME_PICKER_LABELS.periods): string {
	const time = parseTime(value);
	if (time === null) {
		return value;
	}
	const seconds = value.length > "HH:mm".length ? `:${pad(time.seconds)}` : "";
	if (hourCycle === HOURS_PER_DAY) {
		return `${pad(time.hours)}:${pad(time.minutes)}${seconds}`;
	}
	const hour = time.hours % HALF_DAY === 0 ? HALF_DAY : time.hours % HALF_DAY;
	return `${pad(hour)}:${pad(time.minutes)}${seconds} ${time.hours < HALF_DAY ? periods.am : periods.pm}`;
}

/** The picker's default copy; generic and overridable. */
export interface TimePickerLabels {
	readonly hours: string;
	readonly minutes: string;
	readonly seconds: string;
	readonly period: string;
	readonly periods: Readonly<Record<DayPeriod, string>>;
	readonly now: string;
	readonly clear: string;
	readonly done: string;
	readonly cancel: string;
}

export const DEFAULT_TIME_PICKER_LABELS: TimePickerLabels = {
	hours: "Hours",
	minutes: "Minutes",
	seconds: "Seconds",
	period: "AM or PM",
	periods: { am: "AM", pm: "PM" },
	now: "Now",
	clear: "Clear",
	done: "Done",
	cancel: "Cancel",
};

/** What the columns share between the panel and the field. */
export interface TimePickerOptions {
	readonly hourCycle?: HourCycle | undefined;
	readonly withSeconds?: boolean | undefined;
	/** Hide the minutes: an hour-only pick (minutes stay 00). */
	readonly hoursOnly?: boolean | undefined;
	/** The minute (and second) step. Default 1. */
	readonly minuteStep?: number | undefined;
	/** The earliest and latest pickable times ("08:30"). */
	readonly min?: string | undefined;
	readonly max?: string | undefined;
	/** Any other time that cannot be picked ("HH:mm" or "HH:mm:ss" with seconds). */
	readonly isTimeDisabled?: ((value: string) => boolean) | undefined;
	readonly labels?: Partial<TimePickerLabels> | undefined;
}

function secondsOfDay(time: TimeOfDay): number {
	return (time.hours * MINUTES_PER_HOUR + time.minutes) * MINUTES_PER_HOUR + time.seconds;
}

/** Whether a time can be picked under `options`. */
export function isTimePickable(time: TimeOfDay, options: TimePickerOptions): boolean {
	const min = parseTime(options.min ?? null);
	const max = parseTime(options.max ?? null);
	if ((min !== null && secondsOfDay(time) < secondsOfDay(min)) || (max !== null && secondsOfDay(time) > secondsOfDay(max))) {
		return false;
	}
	return options.isTimeDisabled?.(formatTimeValue(time, options.withSeconds === true)) !== true;
}

function range(count: number, step = 1): readonly number[] {
	return Array.from({ length: Math.ceil(count / step) }, (_unused: undefined, index: number): number => index * step);
}

interface ColumnCell {
	readonly key: string;
	readonly label: string;
	readonly picked: boolean;
	readonly disabled: boolean;
	readonly onPick: () => void;
}

interface ColumnProps {
	readonly label: string;
	readonly cells: readonly ColumnCell[];
}

/** One cell, named with its column ("04, Hours") so an hour and a minute of the same number are told apart. */
const CellButton = React.memo(function CellButton({ cell, column }: { readonly cell: ColumnCell; readonly column: string }): React.JSX.Element {
	const state = React.useMemo(() => ({ selected: cell.picked, disabled: cell.disabled }), [cell.disabled, cell.picked]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${cell.label}, ${column}`}
			accessibilityState={state}
			disabled={cell.disabled}
			onPress={cell.onPick}
			className={timePickerColumnCellVariants({ picked: cell.picked, disabled: cell.disabled })}>
			<Text className={timePickerColumnTextVariants({ picked: cell.picked })}>{cell.label}</Text>
		</Pressable>
	);
});

function Column({ label, cells }: ColumnProps): React.JSX.Element {
	return (
		<View accessibilityLabel={label} className="flex-1 gap-1">
			<Text className="text-overline font-sans-semibold text-center text-muted-foreground uppercase">{label}</Text>
			<ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} className="max-h-56">
				<View className="gap-1">
					{cells.map((cell: ColumnCell): React.JSX.Element => (
						<CellButton key={cell.key} cell={cell} column={label} />
					))}
				</View>
			</ScrollView>
		</View>
	);
}

export interface TimePickerPanelProps extends TimePickerOptions {
	readonly value: string | null;
	readonly onChange: (value: string) => void;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The columns themselves: a pick in any column sets the value at once. */
export const TimePickerPanel = React.memo(
	React.forwardRef<ViewInstance, TimePickerPanelProps>(function TimePickerPanel({ value, onChange, className, testID, ...options }, ref): React.JSX.Element {
		const { hourCycle = 24, withSeconds = false, hoursOnly = false, minuteStep = 1 } = options;
		const names = { ...DEFAULT_TIME_PICKER_LABELS, ...options.labels };
		const current = parseTime(value);
		const base: TimeOfDay = current ?? parseTime(options.min ?? null) ?? { hours: 0, minutes: 0, seconds: 0 };
		const set = (next: TimeOfDay): void => {
			onChange(formatTimeValue(next, withSeconds));
		};
		const hourHasFreeMinute = (hours: number): boolean =>
			range(MINUTES_PER_HOUR, minuteStep).some((minutes: number): boolean => isTimePickable({ hours, minutes, seconds: 0 }, options));
		const isPm = base.hours >= HALF_DAY;
		const hourCells: ColumnCell[] = (
			hourCycle === HOURS_PER_DAY ? range(HOURS_PER_DAY) : range(HALF_DAY).map((index: number): number => (index === 0 ? HALF_DAY : index))
		).map((shown: number): ColumnCell => {
			const hours = hourCycle === HOURS_PER_DAY ? shown : (shown % HALF_DAY) + (isPm ? HALF_DAY : 0);
			return {
				key: `h-${String(shown)}`,
				label: pad(shown),
				picked: current?.hours === hours,
				disabled: !hourHasFreeMinute(hours),
				onPick: (): void => {
					set({ ...base, hours });
				},
			};
		});
		const minuteCells: ColumnCell[] = range(MINUTES_PER_HOUR, minuteStep).map((minutes: number): ColumnCell => ({
			key: `m-${String(minutes)}`,
			label: pad(minutes),
			picked: current?.minutes === minutes,
			disabled: !isTimePickable({ ...base, minutes, seconds: 0 }, options),
			onPick: (): void => {
				set({ ...base, minutes });
			},
		}));
		const secondCells: ColumnCell[] = range(MINUTES_PER_HOUR, minuteStep).map((seconds: number): ColumnCell => ({
			key: `s-${String(seconds)}`,
			label: pad(seconds),
			picked: current?.seconds === seconds,
			disabled: !isTimePickable({ ...base, seconds }, options),
			onPick: (): void => {
				set({ ...base, seconds });
			},
		}));
		const periodCells: ColumnCell[] = (["am", "pm"] satisfies DayPeriod[]).map((period: DayPeriod): ColumnCell => ({
			key: period,
			label: names.periods[period],
			picked: current !== null && (period === "pm") === isPm,
			disabled: false,
			onPick: (): void => {
				set({ ...base, hours: (base.hours % HALF_DAY) + (period === "pm" ? HALF_DAY : 0) });
			},
		}));
		return (
			<View ref={ref} testID={testID} className={cn("flex-row gap-2", className)}>
				<Column label={names.hours} cells={hourCells} />
				{hoursOnly ? null : <Column label={names.minutes} cells={minuteCells} />}
				{withSeconds && !hoursOnly ? <Column label={names.seconds} cells={secondCells} /> : null}
				{hourCycle === HALF_DAY ? <Column label={names.period} cells={periodCells} /> : null}
			</View>
		);
	}),
);

export interface TimePickerProps extends TimePickerOptions {
	/** The field's name, and the sheet's title. */
	readonly label: string;
	readonly value: string | null;
	readonly onChange: (value: string | null) => void;
	readonly placeholder?: string | undefined;
	/** Holds picks as a draft until Done; Cancel or closing throws them away. */
	readonly confirm?: boolean | undefined;
	/** Shows Now and Clear in the sheet. */
	readonly showActions?: boolean | undefined;
	/** The current time, for Now ("HH:mm"); the caller reads the clock. */
	readonly now?: string | undefined;
	/** How the value reads in the field (default: the clock's own form). */
	readonly formatTime?: ((value: string) => string) | undefined;
	readonly size?: TimePickerSize | undefined;
	readonly disabled?: boolean | undefined;
	readonly invalid?: boolean | undefined;
	/** Extra classes for the field, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A field showing the time, opening the columns in a sheet. */
export const TimePicker = React.memo(
	React.forwardRef<ViewInstance, TimePickerProps>(function TimePicker(
		{ label, value, onChange, placeholder, confirm = false, showActions = false, now, formatTime, size, disabled, invalid, className, testID, ...options },
		ref,
	): React.JSX.Element {
		const field = useFieldContext();
		const names = { ...DEFAULT_TIME_PICKER_LABELS, ...options.labels };
		const hourCycle = options.hourCycle ?? HOURS_PER_DAY;
		const state = resolveControlState({ disabled: disabled ?? field?.disabled, invalid: invalid ?? field?.invalid });
		const [open, setOpen] = React.useState<boolean>(false);
		const [draft, setDraft] = React.useState<string | null>(value);
		const shown = confirm ? draft : value;
		const show = React.useCallback((): void => {
			setDraft(value);
			setOpen(true);
		}, [value]);
		const close = React.useCallback((): void => {
			setOpen(false);
		}, []);
		const pick = React.useCallback(
			(next: string | null): void => {
				if (confirm) {
					setDraft(next);
				} else {
					onChange(next);
				}
			},
			[confirm, onChange],
		);
		const done = React.useCallback((): void => {
			if (confirm) {
				onChange(draft);
			}
			setOpen(false);
		}, [confirm, draft, onChange]);
		const pickNow = React.useCallback((): void => {
			if (now !== undefined) {
				pick(now);
			}
		}, [now, pick]);
		const clear = React.useCallback((): void => {
			pick(null);
		}, [pick]);
		return (
			<>
				<SelectTrigger
					ref={ref}
					label={field?.label ?? label}
					valueLabel={value === null ? undefined : (formatTime?.(value) ?? displayTime(value, hourCycle, names.periods))}
					placeholder={placeholder}
					leadingIcon={ClockIcon}
					expanded={open}
					onPress={show}
					size={size}
					disabled={isInactiveState(state)}
					invalid={state === "error"}
					className={className}
					testID={testID}
				/>
				<BottomSheet visible={open} title={label} onClose={close} testID={testID === undefined ? undefined : `${testID}-sheet`}>
					<View className="gap-4">
						<TimePickerPanel value={shown} onChange={pick} {...options} />
						<View className="flex-row gap-2">
							{showActions && now !== undefined ? <Button label={names.now} variant="outline" size="sm" onPress={pickNow} /> : null}
							{showActions ? <Button label={names.clear} variant="ghost" size="sm" onPress={clear} /> : null}
							<View className="flex-1" />
							{confirm ? <Button label={names.cancel} variant="outline" size="sm" onPress={close} /> : null}
							<Button label={names.done} size="sm" onPress={done} />
						</View>
					</View>
				</BottomSheet>
			</>
		);
	}),
);
