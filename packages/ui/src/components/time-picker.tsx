"use client";

// Time picker: scrollable hour, minute, second and AM/PM columns, a typable
// input, steps, bounds and localized labels. Ported from reui's time picker;
// its copy comes from the `timePicker` UI kit label family.
import type { BaseUIEvent } from "@base-ui/react/types";
import { hasGlobalConstructor, isNumberPrimitive } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import { resolveFieldState, type FieldState } from "@workspace/ui/lib/form/field-state";
import {
	buildTimeGrid,
	firstEnabledTime,
	floorIndex,
	hasEnabled,
	lastEnabledTime,
	nearestEnabled,
	spanInWindow,
	stepEnabled,
	unitFilter,
	walkEnabled,
	withUnit,
	type TimeFilter,
	type TimeGrid,
	type TimePickerTimeDisabled,
	type TimeStepDirection,
} from "@workspace/ui/lib/time-picker/time-grid";
import {
	formatTimeValue,
	HOURS_PER_PERIOD,
	normalizeTyped,
	padSegment,
	parseTimeInput,
	parseTimeValue,
	periodOf,
	sameTime,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
	toSeconds,
	toTwelveHour,
	type TimePickerColumnType,
	type TimePickerGranularity,
	type TimePickerHourCycle,
	type TimePickerPeriod,
	type TimePickerPeriodPosition,
	type TimePickerTime,
	type TimePickerUnit,
} from "@workspace/ui/lib/time-picker/time-values";
import { cva } from "class-variance-authority";
import { ClockIcon } from "lucide-react";
import * as React from "react";
import { flushSync } from "react-dom";

export { formatTimeValue, parseTimeInput, parseTimeValue };
export type { ParseTimeInputOptions } from "@workspace/ui/lib/time-picker/time-values";
export type {
	TimePickerColumnType,
	TimePickerGranularity,
	TimePickerHourCycle,
	TimePickerPeriod,
	TimePickerPeriodPosition,
	TimePickerTime,
	TimePickerTimeDisabled,
	TimePickerUnit,
};

/* -------------------------------------------------------------------------- */
/*                                    Copy                                    */
/* -------------------------------------------------------------------------- */

/** The time picker's copy — the `timePicker` UI kit label family. */
export interface TimePickerLabels {
	/** Trigger text while there is no value. */
	readonly placeholder: string;
	/** Column headers, which also name the listboxes. */
	readonly hour: string;
	readonly minute: string;
	readonly second: string;
	readonly period: string;
	readonly am: string;
	readonly pm: string;
	readonly now: string;
	readonly clear: string;
	readonly confirm: string;
	/** Names the popup and an inline panel. */
	readonly panelLabel: string;
	/** The clock button in `TimePickerInput`. */
	readonly openPicker: string;
}

export interface TimePickerFormatContext {
	readonly hourCycle: TimePickerHourCycle;
	readonly granularity: TimePickerGranularity;
	readonly periodPosition: TimePickerPeriodPosition;
	readonly labels: TimePickerLabels;
	/** The merged `formatSegment`, so an override reaches `formatValue` too. */
	readonly formatSegment: TimePickerFunctions["formatSegment"];
}

export interface TimePickerFunctions {
	/** Option text in the columns. In 12-hour time the hour arrives as 1 to 12. */
	readonly formatSegment: (value: number, unit: TimePickerUnit) => string;
	/** The value as the trigger and the input show it. */
	readonly formatValue: (time: TimePickerTime, context: TimePickerFormatContext) => string;
}

export interface TimePickerI18nConfig {
	readonly labels: TimePickerLabels;
	readonly functions: TimePickerFunctions;
}

/** One level deeper than `Partial`, so a single label or function can be overridden. */
export interface TimePickerI18nOverrides {
	readonly labels?: Partial<TimePickerLabels> | undefined;
	readonly functions?: Partial<TimePickerFunctions> | undefined;
}

function formatSegmentDefault(value: number): string {
	return padSegment(value);
}

function formatValueDefault(time: TimePickerTime, context: TimePickerFormatContext): string {
	const { hourCycle, granularity, periodPosition, labels, formatSegment } = context;
	const hour = hourCycle === 12 ? toTwelveHour(time.hour) : time.hour;
	const clock = `${formatSegment(hour, "hour")}:${formatSegment(time.minute, "minute")}`;
	const text = granularity === "second" ? `${clock}:${formatSegment(time.second, "second")}` : clock;
	if (hourCycle === 24) {
		return text;
	}
	const period = labels[periodOf(time.hour)];
	return periodPosition === "start" ? `${period} ${text}` : `${text} ${period}`;
}

/** The default segment and value formatters (labels come from `UiKitLabelsProvider`). */
export const DEFAULT_TIME_PICKER_FUNCTIONS: TimePickerFunctions = {
	formatSegment: formatSegmentDefault,
	formatValue: formatValueDefault,
};

/** Merges per section, so an override can carry one key without restating the rest. */
export function mergeTimePickerI18n(base: TimePickerI18nConfig, overrides?: TimePickerI18nOverrides): TimePickerI18nConfig {
	if (overrides?.labels === undefined && overrides?.functions === undefined) {
		return base;
	}
	return {
		labels: { ...base.labels, ...overrides.labels },
		functions: { ...base.functions, ...overrides.functions },
	};
}

/* -------------------------------------------------------------------------- */
/*                                  Variants                                  */
/* -------------------------------------------------------------------------- */

/* `normal-case` and `tracking-normal`: the trigger reads as a field, not an action. */
const timePickerTriggerVariants = cva("justify-between font-normal tracking-normal normal-case tabular-nums data-placeholder:text-muted-foreground", {
	variants: {
		state: {
			default: "",
			loading: "cursor-progress",
			disabled: "cursor-not-allowed",
			error: "border-destructive",
		},
	},
	defaultVariants: { state: "default" },
});

const timePickerInputVariants = cva("", {
	variants: {
		state: {
			default: "",
			loading: "cursor-progress opacity-80",
			disabled: "cursor-not-allowed opacity-50",
			error: "border-destructive",
		},
	},
	defaultVariants: { state: "default" },
});

const timePickerPanelVariants = cva("flex w-fit flex-col", {
	variants: {
		state: {
			default: "",
			loading: "cursor-progress opacity-80",
			disabled: "opacity-50",
			error: "rounded-md ring-1 ring-destructive",
		},
	},
	defaultVariants: { state: "default" },
});

/* -------------------------------------------------------------------------- */
/*                                   Context                                  */
/* -------------------------------------------------------------------------- */

interface ColumnGoal {
	readonly goal: TimePickerTime;
	readonly result: TimePickerTime;
}

interface TimePickerDraft {
	readonly time: TimePickerTime | null;
}

interface TimePickerContextValue {
	readonly id: string;
	/** The committed value. */
	readonly time: TimePickerTime | null;
	/** What the columns show: a pending draft under `requireConfirm`, else the value. */
	readonly display: TimePickerTime | null;
	readonly grid: TimeGrid;
	readonly firstEnabled: TimePickerTime | null;
	readonly hourCycle: TimePickerHourCycle;
	readonly granularity: TimePickerGranularity;
	readonly periodPosition: TimePickerPeriodPosition;
	readonly i18n: TimePickerI18nConfig;
	/** `disabled` or `loading`: nothing can be picked or opened. */
	readonly disabled: boolean;
	readonly loading: boolean;
	readonly readOnly: boolean;
	readonly invalid: boolean;
	readonly state: FieldState;
	readonly requireConfirm: boolean;
	readonly required: boolean;
	readonly fade: boolean;
	readonly label: string | undefined;
	readonly labelledBy: string | undefined;
	readonly describedBy: string | undefined;
	readonly open: boolean;
	readonly setOpen: (open: boolean) => void;
	/** Commits, or writes the draft under `requireConfirm`. */
	readonly select: (time: TimePickerTime | null) => void;
	/** Commits and bypasses the draft. */
	readonly commit: (time: TimePickerTime | null) => void;
	readonly confirm: () => void;
	readonly hasDraft: boolean;
	readonly discardDraft: () => void;
	readonly format: (time: TimePickerTime) => string;
	/** What a column pick aimed at, kept while the value is the time it produced. */
	readonly getGoal: () => ColumnGoal | null;
	readonly setGoal: (goal: ColumnGoal) => void;
	/** The trigger or the input: where a failed `required` check sends focus, and where the root's ref lands. */
	readonly registerFocusTarget: (node: HTMLElement | null) => void;
	readonly registerColumns: (node: HTMLElement | null) => void;
	readonly getColumns: () => HTMLElement | null;
}

const TimePickerContext = React.createContext<TimePickerContextValue | null>(null);

type TimePickerSurface = "inline" | "popup";

/** "inline" unless a part renders inside `TimePickerContent`. */
const SurfaceContext = React.createContext<TimePickerSurface>("inline");

function useTimePickerContext(part: string): TimePickerContextValue {
	const context = React.useContext(TimePickerContext);
	if (context === null) {
		throw new Error(`${part} must be used within a TimePicker`);
	}
	return context;
}

export interface TimePickerApi {
	/** The committed value in the value format, or `null`. */
	readonly value: string | null;
	readonly time: TimePickerTime | null;
	readonly open: boolean;
	readonly setOpen: (open: boolean) => void;
	/** Commits a value as given, with no snapping and no draft. */
	readonly setValue: (value: string | null) => void;
	/** Same as `TimePickerNow`. */
	readonly now: () => void;
	/** Same as `TimePickerClear`. */
	readonly clear: () => void;
	/** Commits a pending draft and closes the popover. */
	readonly confirm: () => void;
}

/* The only clock read, inside an action: reading it while rendering would
   differ between the server and the client. It floors to the steps, so 14:38
   on a 15 minute step is 14:30, then looks forward before back. */
function pickNow(context: TimePickerContextValue): void {
	const now = new Date();
	const { grid } = context;
	const minutes = context.granularity === "hour" ? 0 : now.getMinutes() * SECONDS_PER_MINUTE;
	const seconds = context.granularity === "second" ? now.getSeconds() : 0;
	const index = floorIndex(grid, now.getHours() * SECONDS_PER_HOUR + minutes + seconds);
	const time = walkEnabled(grid, index, 1, false) ?? walkEnabled(grid, index - 1, -1, false);
	if (time !== null) {
		context.select(time);
	}
}

/** The picker's state and actions, inside a `TimePicker`. */
export function useTimePicker(): TimePickerApi {
	const context = useTimePickerContext("useTimePicker");
	return {
		value: context.time === null ? null : formatTimeValue(context.time, context.granularity),
		time: context.time,
		open: context.open,
		setOpen: context.setOpen,
		setValue: (value: string | null): void => {
			context.commit(parseTimeValue(value));
		},
		now: (): void => {
			pickNow(context);
		},
		clear: (): void => {
			context.select(null);
		},
		confirm: context.confirm,
	};
}

const LIST_SELECTOR = '[data-slot="time-picker-column-list"]:not([aria-disabled="true"])';

/** A native `onChange` for the hidden field: it is written by the picker, never typed in. */
function ignoreFieldChange(): void {
	return;
}

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

/** `aria-label`, `aria-labelledby` and `aria-describedby` land on the trigger or the input and name the panel. */
export interface TimePickerProps extends Pick<React.AriaAttributes, "aria-label" | "aria-labelledby" | "aria-describedby"> {
	/** Controlled value, `HH:mm` or `HH:mm:ss` in 24-hour time. `null` is empty. */
	readonly value?: string | null | undefined;
	readonly defaultValue?: string | null | undefined;
	/** Fires with the new value in the same format, or `null` when cleared. */
	readonly onValueChange?: ((value: string | null) => void) | undefined;
	readonly open?: boolean | undefined;
	readonly defaultOpen?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean) => void) | undefined;
	readonly hourCycle?: TimePickerHourCycle | undefined;
	readonly granularity?: TimePickerGranularity | undefined;
	readonly periodPosition?: TimePickerPeriodPosition | undefined;
	readonly hourStep?: number | undefined;
	readonly minuteStep?: number | undefined;
	readonly secondStep?: number | undefined;
	/** Earliest selectable time, inclusive. After `max`, the window runs overnight. */
	readonly min?: string | undefined;
	/** Latest selectable time, inclusive. */
	readonly max?: string | undefined;
	/** Marks single times unavailable. Pass a stable function; it runs per candidate time. */
	readonly isTimeDisabled?: TimePickerTimeDisabled | undefined;
	/** Picks, Now and Clear stay a draft until OK; closing discards them. */
	readonly requireConfirm?: boolean | undefined;
	/** Fades the top and bottom of a column while more rows are scrolled out of view there. */
	readonly fade?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** Shows a busy trigger and blocks picking, e.g. while the allowed times load. */
	readonly loading?: boolean | undefined;
	readonly readOnly?: boolean | undefined;
	readonly invalid?: boolean | undefined;
	/** Submits the value with a native form under this name. */
	readonly name?: string | undefined;
	readonly form?: string | undefined;
	readonly required?: boolean | undefined;
	/** The hidden form field, for form libraries that focus a field on error. */
	readonly inputRef?: React.Ref<HTMLInputElement> | undefined;
	/** Lands on the trigger or the input. */
	readonly id?: string | undefined;
	/** Per-usage copy and formatter overrides; the copy defaults come from `UiKitLabelsProvider`. */
	readonly i18n?: TimePickerI18nOverrides | undefined;
	/** Without children the picker renders a trigger and a popover; these reach the trigger. */
	readonly placeholder?: string | undefined;
	readonly className?: string | undefined;
	/** Fired when the default trigger loses focus. */
	readonly onBlur?: React.FocusEventHandler<HTMLButtonElement> | undefined;
	/** Fired when the default trigger gains focus. */
	readonly onFocus?: React.FocusEventHandler<HTMLButtonElement> | undefined;
	readonly children?: React.ReactNode;
}

/**
 * The time picker root. Without children it renders a trigger button and the
 * popover; compose `TimePickerTrigger` / `TimePickerInput`, `TimePickerContent`
 * or an inline `TimePickerPanel` for anything else. The ref lands on the
 * trigger or the input — the focusable control.
 */
const TimePicker = React.forwardRef<HTMLElement, TimePickerProps>(function TimePicker(
	{
		value,
		defaultValue = null,
		onValueChange,
		open: openProp,
		defaultOpen = false,
		onOpenChange,
		hourCycle = 24,
		granularity = "minute",
		periodPosition = "end",
		hourStep,
		minuteStep,
		secondStep,
		min,
		max,
		isTimeDisabled,
		requireConfirm = false,
		fade = true,
		disabled = false,
		loading = false,
		readOnly = false,
		invalid = false,
		name,
		form,
		required = false,
		inputRef,
		id: idProp,
		"aria-label": label,
		"aria-labelledby": labelledBy,
		"aria-describedby": describedBy,
		i18n: i18nProp,
		placeholder,
		className,
		onBlur,
		onFocus,
		children,
	},
	ref,
): React.JSX.Element {
	const generatedId = React.useId();
	const id = idProp ?? generatedId;
	const [uncontrolled, setUncontrolled] = React.useState<string | null>(defaultValue);
	/* What a form reset restores, as a native field returns to its default. */
	const [initialValue] = React.useState<string | null>(defaultValue);
	const [openState, setOpenState] = React.useState(defaultOpen);
	const [draft, setDraft] = React.useState<TimePickerDraft | null>(null);
	const open = openProp ?? openState;
	/* Every open and close drops the draft, a parent's included. */
	const [seenOpen, setSeenOpen] = React.useState(open);
	if (seenOpen !== open) {
		setSeenOpen(open);
		setDraft(null);
	}
	const goal = React.useRef<ColumnGoal | null>(null);
	const focusTarget = React.useRef<HTMLElement | null>(null);
	const columns = React.useRef<HTMLElement | null>(null);
	const fieldRef = React.useRef<HTMLInputElement | null>(null);
	const resetRef = React.useRef<() => void>(ignoreFieldChange);

	const rawValue = value === undefined ? uncontrolled : value;
	const raw = rawValue === "" ? null : rawValue;
	const time = parseTimeValue(raw);
	const labels = useUiKitLabels("timePicker", i18nProp?.labels);
	const i18n = React.useMemo(
		(): TimePickerI18nConfig => mergeTimePickerI18n({ labels, functions: DEFAULT_TIME_PICKER_FUNCTIONS }, { functions: i18nProp?.functions }),
		[labels, i18nProp?.functions],
	);
	const grid = React.useMemo(
		(): TimeGrid => buildTimeGrid({ hourStep, minuteStep, secondStep, min, max, granularity, isTimeDisabled }),
		[hourStep, minuteStep, secondStep, granularity, min, max, isTimeDisabled],
	);
	const firstEnabled = React.useMemo((): TimePickerTime | null => firstEnabledTime(grid), [grid]);
	const inactive = disabled || loading;
	const state = resolveFieldState({ disabled, loading, ariaInvalid: invalid });

	const setOpen = React.useCallback(
		(next: boolean): void => {
			if (next && inactive) {
				return;
			}
			if (openProp === undefined) {
				setOpenState(next);
			}
			onOpenChange?.(next);
		},
		[inactive, openProp, onOpenChange],
	);

	const commit = (next: TimePickerTime | null): void => {
		setDraft(null);
		const nextValue = next === null ? null : formatTimeValue(next, granularity);
		if (nextValue === raw) {
			return;
		}
		if (value === undefined) {
			setUncontrolled(nextValue);
		}
		onValueChange?.(nextValue);
	};

	const registerFocusTarget = React.useCallback(
		(node: HTMLElement | null): void => {
			if (node !== null) {
				focusTarget.current = node;
			}
			assignRef(ref, node);
		},
		[ref],
	);

	const registerColumns = React.useCallback((node: HTMLElement | null): void => {
		columns.current = node;
	}, []);

	const context: TimePickerContextValue = {
		id,
		time,
		display: draft === null ? time : draft.time,
		grid,
		firstEnabled,
		hourCycle,
		granularity,
		periodPosition,
		i18n,
		disabled: inactive,
		loading,
		readOnly,
		invalid,
		state,
		requireConfirm,
		required,
		fade,
		label,
		labelledBy,
		describedBy,
		open,
		setOpen,
		select: (next: TimePickerTime | null): void => {
			if (inactive || readOnly) {
				return;
			}
			if (requireConfirm) {
				setDraft({ time: next });
			} else {
				commit(next);
			}
		},
		commit,
		confirm: (): void => {
			if (draft !== null) {
				commit(draft.time);
			}
			if (open) {
				setOpen(false);
			}
		},
		hasDraft: draft !== null,
		discardDraft: (): void => {
			setDraft(null);
		},
		format: (next: TimePickerTime): string =>
			i18n.functions.formatValue(next, { hourCycle, granularity, periodPosition, labels: i18n.labels, formatSegment: i18n.functions.formatSegment }),
		getGoal: (): ColumnGoal | null => goal.current,
		setGoal: (next: ColumnGoal): void => {
			goal.current = next;
		},
		registerFocusTarget,
		registerColumns,
		getColumns: (): HTMLElement | null => columns.current,
	};

	React.useEffect((): void => {
		resetRef.current = (): void => {
			commit(parseTimeValue(initialValue));
		};
	});

	/* Listens on the field's own root and asks for its form at reset time, so a
	   `form` attribute is honoured. The restore waits a task, like a native
	   reset's default action, because any listener may still cancel it. */
	const hasField = name !== undefined || required;
	React.useEffect((): (() => void) | undefined => {
		const root = fieldRef.current?.getRootNode();
		if (root === undefined) {
			return undefined;
		}
		let pending = 0;
		const onReset = (event: Event): void => {
			if (event.target !== fieldRef.current?.form) {
				return;
			}
			pending = window.setTimeout((): void => {
				if (!event.defaultPrevented) {
					resetRef.current();
				}
			});
		};
		root.addEventListener("reset", onReset, true);
		return (): void => {
			root.removeEventListener("reset", onReset, true);
			window.clearTimeout(pending);
		};
	}, [hasField]);

	const setFieldRef = React.useCallback(
		(node: HTMLInputElement | null): void => {
			fieldRef.current = node;
			assignRef(inputRef, node);
		},
		[inputRef],
	);

	/* A failed `required` check focuses the hidden field; hand that to the control. */
	const handleFieldFocus = React.useCallback((event: React.FocusEvent<HTMLInputElement>): void => {
		const target = focusTarget.current ?? columns.current?.querySelector<HTMLElement>(LIST_SELECTOR) ?? null;
		if (target === null) {
			event.currentTarget.blur();
		} else {
			target.focus();
		}
	}, []);

	return (
		<TimePickerContext.Provider value={context}>
			<Popover open={open} onOpenChange={setOpen}>
				{children === undefined ? (
					<>
						<TimePickerTrigger className={className} placeholder={placeholder} onBlur={onBlur} onFocus={onFocus} />
						<TimePickerContent />
					</>
				) : (
					children
				)}
			</Popover>
			{hasField ? (
				<input
					ref={setFieldRef}
					type="text"
					name={name}
					form={form}
					required={required}
					disabled={disabled}
					value={time === null ? "" : formatTimeValue(time, granularity)}
					onChange={ignoreFieldChange}
					tabIndex={-1}
					aria-hidden="true"
					data-slot="time-picker-field"
					onFocus={handleFieldFocus}
					className="pointer-events-none absolute size-px max-w-px opacity-0"
				/>
			) : null}
		</TimePickerContext.Provider>
	);
});

/* -------------------------------------------------------------------------- */
/*                                  Triggers                                  */
/* -------------------------------------------------------------------------- */

export type TimePickerValueProps = Omit<React.ComponentPropsWithoutRef<"span">, "children"> & {
	readonly placeholder?: React.ReactNode;
};

/** The committed value as text, or the placeholder. For custom trigger content. */
const TimePickerValue = React.forwardRef<HTMLSpanElement, TimePickerValueProps>(function TimePickerValue({ placeholder, className, ...props }, ref): React.JSX.Element {
	const context = useTimePickerContext("TimePickerValue");
	return (
		<span
			ref={ref}
			id={`${context.id}-value`}
			data-slot="time-picker-value"
			data-placeholder={context.time === null ? "" : undefined}
			className={cn("truncate", className)}
			{...props}>
			{context.time === null ? (placeholder ?? context.i18n.labels.placeholder) : context.format(context.time)}
		</span>
	);
});

export type TimePickerTriggerProps = Omit<React.ComponentPropsWithoutRef<typeof Button>, "className"> & {
	readonly placeholder?: React.ReactNode;
	readonly className?: string | undefined;
};

/** A kit Button that opens the picker. Children replace the value and icon. */
const TimePickerTrigger = React.forwardRef<HTMLButtonElement, TimePickerTriggerProps>(function TimePickerTrigger(
	{ className, variant = "outline", placeholder, children, "aria-labelledby": labelledByProp, ...props },
	ref,
): React.JSX.Element {
	const context = useTimePickerContext("TimePickerTrigger");
	const { registerFocusTarget } = context;
	const setRef = React.useCallback(
		(node: HTMLButtonElement | null): void => {
			registerFocusTarget(node);
			assignRef(ref, node);
		},
		[registerFocusTarget, ref],
	);
	const labelledBy = labelledByProp ?? context.labelledBy;
	/* `loading` disables the Button itself, with its spinner. */
	const buttonDisabled = context.disabled && !context.loading;
	const content =
		children === undefined ? (
			<>
				<TimePickerValue placeholder={placeholder} />
				<span data-icon="inline-end" aria-hidden="true" className="flex text-muted-foreground">
					<ClockIcon aria-hidden="true" />
				</span>
			</>
		) : (
			children
		);

	return (
		<PopoverTrigger
			ref={setRef}
			id={context.id}
			render={
				<Button
					variant={variant}
					disabled={buttonDisabled}
					loading={context.loading}
					aria-label={context.label}
					aria-describedby={context.describedBy}
					aria-invalid={context.invalid ? true : undefined}
					data-invalid={context.invalid ? "" : undefined}
					{...props}
					/* The value stays in the name: a label alone replaces a button's text. */
					aria-labelledby={labelledBy === undefined ? undefined : `${labelledBy} ${context.id}-value`}
					id={context.id}
					data-slot="time-picker-trigger"
					data-placeholder={context.time === null ? "" : undefined}
					className={cn(timePickerTriggerVariants({ state: context.state }), className)}
				/>
			}>
			{content}
		</PopoverTrigger>
	);
});

export type TimePickerInputProps = Omit<React.ComponentPropsWithoutRef<typeof InputGroupInput>, "value" | "defaultValue">;

function inputMask(context: TimePickerContextValue): string {
	if (context.hourCycle === 12) {
		return context.periodPosition === "start" ? "-- --:--" : "--:-- --";
	}
	return context.granularity === "second" ? "--:--:--" : "--:--";
}

/** The period a 12-hour time typed without one takes: the one on screen, else the first selectable one. */
function typedPeriodFallback(context: TimePickerContextValue): TimePickerPeriod {
	if (context.time !== null) {
		return periodOf(context.time.hour);
	}
	return context.firstEnabled === null ? "am" : periodOf(context.firstEnabled.hour);
}

/** Reads typed text into a time, preferring the half of the day the bounds allow. */
function parseTyped(context: TimePickerContextValue, source: string): TimePickerTime | null {
	const { labels } = context.i18n;
	if (context.hourCycle === 24) {
		return parseTimeInput(source, { labels });
	}
	/* No period typed: prefer the one on screen, but not over a time that
	   only the other half of the day allows (2:30 with a morning minimum). */
	const period = typedPeriodFallback(context);
	const here = parseTimeInput(source, { hourCycle: 12, labels, period });
	const there = parseTimeInput(source, { hourCycle: 12, labels, period: period === "am" ? "pm" : "am" });
	if (here === null || there === null || sameTime(here, there)) {
		return here;
	}
	const inBounds = (typed: TimePickerTime): boolean => spanInWindow(context.grid, toSeconds(typed), toSeconds(typed));
	if (inBounds(here)) {
		return here;
	}
	return inBounds(there) ? there : here;
}

/** Drops the units finer than the granularity. */
function truncateToGranularity(time: TimePickerTime, granularity: TimePickerGranularity): TimePickerTime {
	return {
		hour: time.hour,
		minute: granularity === "hour" ? 0 : time.minute,
		second: granularity === "second" ? time.second : 0,
	};
}

/**
 * A typable field with a clock button that opens the picker. Text is read on
 * blur and Enter; ArrowUp and ArrowDown step to the next selectable time and
 * Alt+ArrowDown opens the popover.
 */
const TimePickerInput = React.forwardRef<HTMLInputElement, TimePickerInputProps>(function TimePickerInput(
	{ className, placeholder, onBlur, onKeyDown, onChange, ...props },
	ref,
): React.JSX.Element {
	const context = useTimePickerContext("TimePickerInput");
	const { registerFocusTarget } = context;
	/* `null` while the field shows the value rather than an edit in progress. */
	const [text, setText] = React.useState<string | null>(null);
	const formatted = context.time === null ? "" : context.format(context.time);
	const shown = text ?? formatted;

	const read = (): void => {
		if (text === null) {
			return;
		}
		setText(null);
		if (text.trim() === "") {
			context.commit(null);
			return;
		}
		/* A custom formatValue may not parse back; unchanged text is no edit. */
		if (text === formatted) {
			return;
		}
		const typed = parseTyped(context, text);
		if (typed === null) {
			return;
		}
		/* Snaps to the steps as well as the bounds: an enabled time on the grid is its own nearest. */
		const next = nearestEnabled(context.grid, truncateToGranularity(typed, context.granularity));
		if (next !== null) {
			context.commit(next);
		}
	};

	const step = (direction: TimeStepDirection): void => {
		const typed = text === null ? null : parseTyped(context, text);
		const from = typed ?? context.time;
		let next: TimePickerTime | null;
		if (from !== null) {
			next = stepEnabled(context.grid, from, direction);
		} else {
			next = direction === 1 ? context.firstEnabled : lastEnabledTime(context.grid);
		}
		setText(null);
		if (next !== null) {
			context.commit(next);
		}
	};

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange?.(event);
			setText(event.target.value);
		},
		[onChange],
	);

	const handleBlur = (event: React.FocusEvent<HTMLInputElement>): void => {
		onBlur?.(event);
		read();
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
		onKeyDown?.(event);
		if (event.defaultPrevented) {
			return;
		}
		if (event.key === "Enter") {
			/* Flushed, so an implicit form submit reads the new value. */
			flushSync(read);
		} else if (event.key === "Escape" && text !== null) {
			event.preventDefault();
			setText(null);
		} else if (event.altKey && event.key === "ArrowDown") {
			event.preventDefault();
			read();
			context.setOpen(true);
		} else if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !event.altKey && !context.readOnly) {
			event.preventDefault();
			step(event.key === "ArrowUp" ? 1 : -1);
		}
	};

	/* The handlers read this render's text and value through refs, so the
	   input gets stable props (`react/jsx-no-bind`). */
	const handleBlurRef = React.useRef(handleBlur);
	const handleKeyDownRef = React.useRef(handleKeyDown);
	React.useLayoutEffect((): void => {
		handleBlurRef.current = handleBlur;
		handleKeyDownRef.current = handleKeyDown;
	});

	const onInputBlur = React.useCallback((event: React.FocusEvent<HTMLInputElement>): void => {
		handleBlurRef.current(event);
	}, []);
	const onInputKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLInputElement>): void => {
		handleKeyDownRef.current(event);
	}, []);

	const setRef = React.useCallback(
		(node: HTMLInputElement | null): void => {
			registerFocusTarget(node);
			assignRef(ref, node);
		},
		[registerFocusTarget, ref],
	);

	return (
		<InputGroup data-slot="time-picker-input" data-disabled={context.disabled ? "" : undefined} className={cn(timePickerInputVariants({ state: context.state }), className)}>
			<InputGroupInput
				value={shown}
				placeholder={placeholder ?? inputMask(context)}
				disabled={context.disabled}
				readOnly={context.readOnly}
				required={context.required}
				autoComplete="off"
				autoCorrect="off"
				autoCapitalize="off"
				spellCheck={false}
				aria-keyshortcuts="Alt+ArrowDown"
				aria-label={context.label}
				aria-labelledby={context.labelledBy}
				aria-describedby={context.describedBy}
				aria-invalid={context.invalid ? true : undefined}
				className="tabular-nums"
				onChange={handleChange}
				onBlur={onInputBlur}
				onKeyDown={onInputKeyDown}
				{...props}
				id={context.id}
				ref={setRef}
			/>
			<InputGroupAddon align="inline-end">
				<PopoverTrigger
					render={<InputGroupButton size="icon-xs" disabled={context.disabled} aria-label={context.i18n.labels.openPicker} data-slot="time-picker-input-trigger" />}>
					<ClockIcon aria-hidden="true" />
				</PopoverTrigger>
			</InputGroupAddon>
		</InputGroup>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Panel                                   */
/* -------------------------------------------------------------------------- */

const TABBABLE = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export type TimePickerContentProps = React.ComponentPropsWithoutRef<typeof PopoverContent>;

/** Tab cycles inside the popup, as in a date picker dialog. */
function cycleTabFocus(event: React.KeyboardEvent<HTMLDivElement>): void {
	if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) {
		return;
	}
	const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(TABBABLE));
	const active = event.currentTarget.ownerDocument.activeElement;
	const first = items.at(0);
	const last = items.at(-1);
	if (!event.shiftKey && active === last) {
		event.preventDefault();
		first?.focus();
	} else if (event.shiftKey && active === first) {
		event.preventDefault();
		last?.focus();
	}
}

/** The popover: columns and footer by default. */
const TimePickerContent = React.forwardRef<HTMLDivElement, TimePickerContentProps>(function TimePickerContent(
	{ className, align = "start", onKeyDown, children, ...props },
	ref,
): React.JSX.Element {
	const context = useTimePickerContext("TimePickerContent");
	const handleKeyDown = React.useCallback(
		(event: BaseUIEvent<React.KeyboardEvent<HTMLDivElement>>): void => {
			onKeyDown?.(event);
			if (!event.defaultPrevented) {
				cycleTabFocus(event);
			}
		},
		[onKeyDown],
	);
	return (
		<PopoverContent
			ref={ref}
			align={align}
			aria-labelledby={context.labelledBy}
			aria-label={context.labelledBy === undefined ? (context.label ?? context.i18n.labels.panelLabel) : undefined}
			className={cn("w-auto gap-0 overflow-hidden p-0", className)}
			onKeyDown={handleKeyDown}
			{...props}>
			<SurfaceContext.Provider value="popup">
				{children === undefined ? (
					<>
						<TimePickerColumns />
						<TimePickerFooter />
					</>
				) : (
					children
				)}
			</SurfaceContext.Provider>
		</PopoverContent>
	);
});

export type TimePickerPanelProps = React.ComponentPropsWithoutRef<"div">;

/**
 * The columns and the footer, rendered in place: put it straight inside a
 * `TimePicker`, with no trigger or content, for an always-open picker.
 */
const TimePickerPanel = React.forwardRef<HTMLDivElement, TimePickerPanelProps>(function TimePickerPanel({ className, children, ...props }, ref): React.JSX.Element {
	const context = useTimePickerContext("TimePickerPanel");
	const inline = React.useContext(SurfaceContext) === "inline";
	return (
		<div
			ref={ref}
			role={inline ? "group" : undefined}
			aria-labelledby={inline ? context.labelledBy : undefined}
			aria-label={inline && context.labelledBy === undefined ? (context.label ?? context.i18n.labels.panelLabel) : undefined}
			data-slot="time-picker-panel"
			data-disabled={context.disabled ? "" : undefined}
			className={cn(timePickerPanelVariants({ state: context.state }), className)}
			{...props}>
			{children === undefined ? (
				<>
					<TimePickerColumns />
					<TimePickerFooter />
				</>
			) : (
				children
			)}
		</div>
	);
});

export type TimePickerColumnsProps = React.ComponentPropsWithoutRef<"div">;

/**
 * The row of columns: one per unit the picker needs by default. Always left
 * to right, because a time reads hour first in right-to-left text too.
 */
const TimePickerColumns = React.forwardRef<HTMLDivElement, TimePickerColumnsProps>(function TimePickerColumns({ className, children, ...props }, ref): React.JSX.Element {
	const context = useTimePickerContext("TimePickerColumns");
	const { display, granularity, registerColumns } = context;
	const setRef = React.useCallback(
		(node: HTMLDivElement | null): void => {
			registerColumns(node);
			assignRef(ref, node);
		},
		[registerColumns, ref],
	);
	const period = context.hourCycle === 12 ? <TimePickerColumn type="period" /> : null;
	return (
		<div dir="ltr" data-slot="time-picker-columns" className={cn("flex divide-x", className)} {...props} ref={setRef}>
			<span id={`${context.id}-current`} hidden>
				{display === null ? context.i18n.labels.placeholder : context.format(display)}
			</span>
			{children === undefined ? (
				<>
					{context.periodPosition === "start" ? period : null}
					<TimePickerColumn type="hour" />
					{granularity === "hour" ? null : <TimePickerColumn type="minute" />}
					{granularity === "second" ? <TimePickerColumn type="second" /> : null}
					{context.periodPosition === "end" ? period : null}
				</>
			) : (
				children
			)}
		</div>
	);
});

/* Row height and list padding follow the kit Select item and group, as custom
   properties so a list is exactly N rows tall; the 4px list padding keeps the
   focus ring from clipping. */
const COLUMN_CLASS =
	"group/time-picker-column flex min-w-16 flex-1 flex-col [--time-picker-option-height:calc(var(--spacing)*8)] [--time-picker-list-padding:calc(var(--spacing)*1)]";

/* The Select label, centered, with a little more room on top so the header
   clears the surface edge. It gains contrast while its list has keyboard
   focus, which says which column the arrows move. */
const LABEL_CLASS =
	"px-2 pt-2.5 pb-1.5 text-center text-xs whitespace-nowrap text-muted-foreground transition-colors select-none group-has-focus-visible/time-picker-column:text-foreground";

/* Five rows unless an ancestor sets `--time-picker-rows`; keep it odd so the
   selection can sit in the middle. The fade masks only an end with rows
   scrolled past it, so the first and last rows are never dimmed at rest;
   `--time-picker-fade-size` sets its depth. The mask's opaque stop is a mask
   value, not a colour. */
const LIST_CLASS =
	"group/time-picker-list relative flex h-[calc(var(--time-picker-option-height)*var(--time-picker-rows,5)+var(--spacing)*(var(--time-picker-rows,5)-1)+var(--time-picker-list-padding)*2)] flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-(--time-picker-list-padding) outline-none [scrollbar-width:none] data-empty:focus-visible:outline-2 data-empty:focus-visible:-outline-offset-2 data-empty:focus-visible:outline-ring data-empty:focus-visible:outline-solid data-fade:[mask-image:linear-gradient(to_bottom,transparent,black_var(--time-picker-fade-start,0px),black_calc(100%-var(--time-picker-fade-end,0px)),transparent)] data-overflow-end:[--time-picker-fade-end:var(--time-picker-fade-size,var(--time-picker-option-height))] data-overflow-start:[--time-picker-fade-start:var(--time-picker-fade-size,var(--time-picker-option-height))] [&::-webkit-scrollbar]:hidden";

/* Radius and type follow the Select item; the keyboard ring follows the
   Button's focus ring. The filled pill for the value is this primitive's own:
   a select marks its choice with a check. */
const OPTION_CLASS =
	"flex h-(--time-picker-option-height) shrink-0 cursor-default items-center justify-center rounded-sm text-sm tabular-nums ring-ring/50 transition-[color,background-color,box-shadow] duration-100 select-none not-aria-selected:hover:bg-accent not-aria-selected:hover:text-accent-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-selected:bg-primary aria-selected:font-medium aria-selected:text-primary-foreground group-focus-visible/time-picker-list:data-highlighted:ring-3 forced-colors:aria-selected:bg-[Highlight] forced-colors:aria-selected:text-[HighlightText] forced-colors:group-focus-visible/time-picker-list:data-highlighted:outline-2 forced-colors:group-focus-visible/time-picker-list:data-highlighted:outline-solid";

/** Scroll slack (px) below which a list end counts as reached. */
const OVERFLOW_TOLERANCE_PX = 1;
/** Rows PageUp / PageDown move. */
const PAGE_ROWS = 5;
/** Two digits typed within this window read as one number: 1 then 4 is 14. */
const TYPEAHEAD_WINDOW_MS = 1000;
/** Half a row: the arrows' starting point for a value between two rows. */
const HALF_ROW = 0.5;
const DIGIT_PATTERN = /\d/u;
const PERIODS: readonly [TimePickerPeriod, TimePickerPeriod] = ["am", "pm"];
const OPTION_ROW_SELECTOR = "[data-option-index]";

/* Marks which ends of a list have rows scrolled out of view, for the fade.
   Written to the DOM directly: it changes every scroll frame and nothing
   renders from it. */
function syncOverflow(list: HTMLElement): void {
	list.toggleAttribute("data-overflow-start", list.scrollTop > OVERFLOW_TOLERANCE_PX);
	list.toggleAttribute("data-overflow-end", list.scrollTop + list.clientHeight < list.scrollHeight - OVERFLOW_TOLERANCE_PX);
}

function handleListScroll(event: React.UIEvent<HTMLDivElement>): void {
	syncOverflow(event.currentTarget);
}

type TimePickerOptionValue = number | TimePickerPeriod;

interface TimePickerOption {
	readonly value: TimePickerOptionValue;
	readonly label: string;
	/** The number typed to reach it: 12-hour labels, not 24-hour values. */
	readonly typed: number | null;
	readonly disabled: boolean;
}

interface TypeaheadBuffer {
	readonly text: string;
	readonly at: number;
}

export type TimePickerColumnProps = Omit<React.ComponentPropsWithoutRef<"div">, "children"> & {
	readonly type: TimePickerColumnType;
	/** Header text. Defaults to the label for the type. */
	readonly label?: React.ReactNode;
};

function columnValueOf(time: TimePickerTime, type: TimePickerColumnType): TimePickerOptionValue {
	return type === "period" ? periodOf(time.hour) : time[type];
}

function columnOptions(
	type: TimePickerColumnType,
	grid: TimeGrid,
	flags: readonly boolean[],
	hourCycle: TimePickerHourCycle,
	period: TimePickerPeriod,
	i18n: TimePickerI18nConfig,
): TimePickerOption[] {
	const { formatSegment } = i18n.functions;
	if (type === "period") {
		return PERIODS.map((value: TimePickerPeriod, index: number): TimePickerOption => ({ value, label: i18n.labels[value], typed: null, disabled: flags[index] !== true }));
	}
	if (type === "hour") {
		return grid.hours.flatMap((hour: number, index: number): TimePickerOption[] => {
			if (hourCycle === 12 && periodOf(hour) !== period) {
				return [];
			}
			const shown = hourCycle === 12 ? toTwelveHour(hour) : hour;
			return [{ value: hour, label: formatSegment(shown, "hour"), typed: shown, disabled: flags[index] !== true }];
		});
	}
	const values = type === "minute" ? grid.minutes : grid.seconds;
	return values.map((value: number, index: number): TimePickerOption => ({ value, label: formatSegment(value, type), typed: value, disabled: flags[index] !== true }));
}

/* `Array.prototype.findLast` is ES2023, newer than this package's `lib`. */
function findLast<T>(items: readonly T[], test: (item: T) => boolean): T | undefined {
	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];
		if (item !== undefined && test(item)) {
			return item;
		}
	}
	return undefined;
}

/**
 * The row the keyboard sits on: the selection; for a value off the steps
 * the enabled row below it; when empty, the first enabled time's row.
 */
function highlightFor(
	options: readonly TimePickerOption[],
	enabled: readonly number[],
	selectedIndex: number,
	current: TimePickerOptionValue | undefined,
	first: TimePickerOptionValue | undefined,
): number {
	if (selectedIndex !== -1) {
		return selectedIndex;
	}
	if (current !== undefined && isNumberPrimitive(current)) {
		const below = findLast(enabled, (index: number): boolean => {
			const value = options[index]?.value;
			return value !== undefined && isNumberPrimitive(value) && value < current;
		});
		return below ?? enabled.at(0) ?? -1;
	}
	const preferred = enabled.find((index: number): boolean => options[index]?.value === first);
	return preferred ?? enabled.at(0) ?? -1;
}

/** Where the arrows start: the selected row, between rows for a value off the steps, and just short of the highlight when empty. */
function arrowStart(options: readonly TimePickerOption[], selectedIndex: number, highlightIndex: number, current: TimePickerOptionValue | undefined, down: boolean): number {
	if (selectedIndex !== -1) {
		return selectedIndex;
	}
	if (current !== undefined && isNumberPrimitive(current)) {
		const above = options.findIndex((option: TimePickerOption): boolean => isNumberPrimitive(option.value) && option.value > current);
		return (above === -1 ? options.length : above) - HALF_ROW;
	}
	if (highlightIndex === -1) {
		return -HALF_ROW;
	}
	return highlightIndex + (down ? -HALF_ROW : HALF_ROW);
}

/** The time a pick of `value` in a `type` column aims at, and the filter that keeps the picked field. */
function pickTarget(base: TimePickerTime, type: TimePickerColumnType, value: TimePickerOptionValue): { readonly target: TimePickerTime; readonly filter: TimeFilter } | null {
	if (type === "period") {
		if (isNumberPrimitive(value)) {
			return null;
		}
		return { target: { ...base, hour: (base.hour % HOURS_PER_PERIOD) + (value === "pm" ? HOURS_PER_PERIOD : 0) }, filter: { period: value } };
	}
	if (!isNumberPrimitive(value)) {
		return null;
	}
	return { target: withUnit(base, type, value), filter: unitFilter(type, value) };
}

function fallbackListPeriod(display: TimePickerTime | null, firstEnabled: TimePickerTime | null): TimePickerPeriod {
	if (display !== null) {
		return periodOf(display.hour);
	}
	return firstEnabled === null ? "am" : periodOf(firstEnabled.hour);
}

function isColumnHidden(type: TimePickerColumnType, hourCycle: TimePickerHourCycle, granularity: TimePickerGranularity): boolean {
	return (type === "period" && hourCycle !== 12) || (type === "minute" && granularity === "hour") || (type === "second" && granularity !== "second");
}

const MIDNIGHT: TimePickerTime = { hour: 0, minute: 0, second: 0 };

/**
 * One unit as a listbox. Selection follows the keyboard, like a native wheel.
 * Renders nothing for a unit the granularity or the hour cycle leaves out.
 */
const TimePickerColumn = React.forwardRef<HTMLDivElement, TimePickerColumnProps>(function TimePickerColumn(
	{ type, label, className, ...props },
	ref,
): React.JSX.Element | null {
	const context = useTimePickerContext("TimePickerColumn");
	const { display, grid, hourCycle, i18n, firstEnabled } = context;
	const baseId = React.useId();
	const listRef = React.useRef<HTMLDivElement>(null);
	const typeahead = React.useRef<TypeaheadBuffer>({ text: "", at: 0 });

	const listPeriod = fallbackListPeriod(display, firstEnabled);
	const displayHour = display?.hour;
	const displayMinute = display?.minute;
	/* Availability is the expensive part; labels are recomputed freely. */
	const flags = React.useMemo((): boolean[] => {
		if (type === "period") {
			return PERIODS.map((period: TimePickerPeriod): boolean => hasEnabled(grid, { period }));
		}
		if (type === "hour") {
			return grid.hours.map((hour: number): boolean => hasEnabled(grid, { hour }));
		}
		const values = type === "minute" ? grid.minutes : grid.seconds;
		return values.map((value: number): boolean =>
			hasEnabled(grid, {
				hour: displayHour,
				minute: type === "second" ? displayMinute : value,
				second: type === "second" ? value : undefined,
			}),
		);
	}, [type, grid, displayHour, displayMinute]);

	const options = columnOptions(type, grid, flags, hourCycle, listPeriod, i18n);
	const current = display === null ? undefined : columnValueOf(display, type);
	const selectedIndex = options.findIndex((option: TimePickerOption): boolean => option.value === current);
	const enabled = options.flatMap((option: TimePickerOption, index: number): number[] => (option.disabled ? [] : [index]));
	const highlightIndex = highlightFor(options, enabled, selectedIndex, current, firstEnabled !== null && display === null ? columnValueOf(firstEnabled, type) : undefined);
	const highlighted = options[highlightIndex];
	const optionId = (option: TimePickerOption): string => `${baseId}-${String(option.value)}`;
	const highlightedId = highlighted === undefined ? undefined : optionId(highlighted);
	const interactive = !context.disabled;
	const editable = interactive && !context.readOnly;

	/* Centers the highlighted row, instantly, whenever it changes, and again
	   when the list resizes: rows take their height from the style, which can
	   settle after mount. `offsetTop` ignores the popup's zoom-in transform;
	   `scrollIntoView` would not, and would scroll the page too. */
	React.useLayoutEffect((): (() => void) | undefined => {
		const list = listRef.current;
		if (list === null) {
			return undefined;
		}
		const center = (): void => {
			const option = highlightedId === undefined ? null : list.ownerDocument.getElementById(highlightedId);
			if (option !== null) {
				list.scrollTop = option.offsetTop - (list.clientHeight - option.offsetHeight) / 2;
			}
			syncOverflow(list);
		};
		center();
		if (!hasGlobalConstructor("ResizeObserver")) {
			return undefined;
		}
		const observer = new ResizeObserver(center);
		observer.observe(list);
		return (): void => {
			observer.disconnect();
		};
	}, [highlightedId]);

	const pick = (option: TimePickerOption | undefined): void => {
		if (option === undefined || option.disabled || !editable) {
			return;
		}
		/* Aim from the last goal while the value is still what it produced, so
		   09:15 through a clamped 08:30 comes back to 09:15, not 09:30. */
		const kept = context.getGoal();
		const base = kept !== null && sameTime(kept.result, display) ? kept.goal : (display ?? MIDNIGHT);
		const aim = pickTarget(base, type, option.value);
		if (aim === null) {
			return;
		}
		const time = nearestEnabled(grid, aim.target, aim.filter);
		if (time === null) {
			return;
		}
		context.setGoal({ goal: aim.target, result: time });
		context.select(time);
	};

	const typeaheadIndex = (key: string, timeStamp: number): number => {
		if (type === "period") {
			const found = enabled.filter((index: number): boolean => {
				const option = options[index];
				if (option === undefined) {
					return false;
				}
				return (key === "a" && option.value === "am") || (key === "p" && option.value === "pm") || normalizeTyped(option.label).startsWith(key);
			});
			/* The same letter again moves to the next match. */
			return found[(found.indexOf(highlightIndex) + 1) % found.length] ?? -1;
		}
		if (!DIGIT_PATTERN.test(key)) {
			return -1;
		}
		const buffer = typeahead.current;
		const fresh = timeStamp - buffer.at > TYPEAHEAD_WINDOW_MS;
		let typed = !fresh && buffer.text.length === 1 ? buffer.text + key : key;
		const find = (digits: string): number => options.findIndex((option: TimePickerOption): boolean => !option.disabled && option.typed === Number(digits));
		let index = find(typed);
		if (index === -1 && typed.length > 1) {
			typed = key;
			index = find(typed);
		}
		if (index === -1) {
			/* "3" on a 15 minute step reaches 30. */
			index = options.findIndex((option: TimePickerOption): boolean => !option.disabled && option.typed !== null && padSegment(option.typed).startsWith(typed));
		}
		typeahead.current = { text: typed, at: timeStamp };
		return index;
	};

	const keyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
		if (event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) {
			return;
		}
		if (event.altKey) {
			if (event.key === "ArrowUp" && context.open) {
				event.preventDefault();
				context.confirm();
			}
			return;
		}
		const down = event.key === "ArrowDown" || event.key === "PageDown";
		const position = arrowStart(options, selectedIndex, highlightIndex, current, down);
		const move = (index: number | undefined): void => {
			event.preventDefault();
			if (index !== undefined) {
				pick(options[index]);
			}
		};
		const first = enabled.at(0);
		const last = enabled.at(-1);

		switch (event.key) {
			case "ArrowDown":
				move(enabled.find((index: number): boolean => index > position));
				return;
			case "ArrowUp":
				move(findLast(enabled, (index: number): boolean => index < position));
				return;
			case "Home":
				move(first);
				return;
			case "End":
				move(last);
				return;
			case "PageDown":
				move(enabled.find((index: number): boolean => index >= position + PAGE_ROWS) ?? last);
				return;
			case "PageUp":
				move(findLast(enabled, (index: number): boolean => index <= position - PAGE_ROWS) ?? first);
				return;
			case "ArrowLeft":
			case "ArrowRight": {
				event.preventDefault();
				const lists = Array.from(context.getColumns()?.querySelectorAll<HTMLElement>(LIST_SELECTOR) ?? []);
				const at = lists.indexOf(event.currentTarget);
				lists[at + (event.key === "ArrowRight" ? 1 : -1)]?.focus();
				return;
			}
			case " ":
				event.preventDefault();
				if (highlightIndex !== selectedIndex) {
					pick(highlighted);
				}
				return;
			case "Enter":
				event.preventDefault();
				if (highlightIndex !== selectedIndex) {
					pick(highlighted);
				}
				context.confirm();
				return;
			case "Escape":
				/* Inline, Escape drops a draft; in the popover it closes it. */
				if (!context.open && context.hasDraft) {
					event.preventDefault();
					event.stopPropagation();
					context.discardDraft();
				}
				return;
			default:
				break;
		}

		const key = normalizeTyped(event.key);
		if (key.length !== 1) {
			return;
		}
		const index = typeaheadIndex(key, event.timeStamp);
		if (index !== -1) {
			move(index);
		}
	};

	/* Handlers read this render's options through refs, so the listbox gets
	   stable props (`react/jsx-no-bind`). */
	const keyDownRef = React.useRef(keyDown);
	const pickRef = React.useRef(pick);
	const optionsRef = React.useRef(options);
	React.useLayoutEffect((): void => {
		keyDownRef.current = keyDown;
		pickRef.current = pick;
		optionsRef.current = options;
	});

	const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
		keyDownRef.current(event);
	}, []);

	/* One listener for every row: a click picks the row it landed in. */
	const handleClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
		const { target } = event;
		if (!(target instanceof Element)) {
			return;
		}
		const row = target.closest<HTMLElement>(OPTION_ROW_SELECTOR);
		if (row === null) {
			return;
		}
		pickRef.current(optionsRef.current[Number(row.dataset.optionIndex)]);
	}, []);

	if (isColumnHidden(type, hourCycle, context.granularity)) {
		return null;
	}

	const headerId = `${baseId}-label`;

	return (
		<div ref={ref} data-slot="time-picker-column" data-type={type} className={cn(COLUMN_CLASS, className)} {...props}>
			<div id={headerId} data-slot="time-picker-column-label" className={LABEL_CLASS}>
				{label ?? i18n.labels[type]}
			</div>
			<div
				ref={listRef}
				role="listbox"
				aria-labelledby={headerId}
				aria-describedby={`${context.id}-current`}
				aria-activedescendant={highlightedId}
				aria-disabled={context.disabled ? true : undefined}
				aria-readonly={context.readOnly ? true : undefined}
				tabIndex={interactive ? 0 : -1}
				data-slot="time-picker-column-list"
				data-empty={highlighted === undefined ? "" : undefined}
				data-fade={context.fade ? "" : undefined}
				onKeyDown={interactive ? handleKeyDown : undefined}
				onClick={editable ? handleClick : undefined}
				onScroll={handleListScroll}
				className={LIST_CLASS}>
				{options.map((option: TimePickerOption, index: number): React.JSX.Element => (
					<div
						key={option.value}
						id={optionId(option)}
						role="option"
						aria-selected={index === selectedIndex}
						aria-disabled={option.disabled ? true : undefined}
						data-highlighted={index === highlightIndex ? "" : undefined}
						data-option-index={index}
						data-slot="time-picker-option"
						className={OPTION_CLASS}>
						{option.label}
					</div>
				))}
			</div>
		</div>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Footer                                   */
/* -------------------------------------------------------------------------- */

export type TimePickerFooterProps = React.ComponentPropsWithoutRef<"div">;

/** The action row. Without children: Now and Clear, plus OK in a popover or under `requireConfirm`. */
const TimePickerFooter = React.forwardRef<HTMLDivElement, TimePickerFooterProps>(function TimePickerFooter({ className, children, ...props }, ref): React.JSX.Element {
	const context = useTimePickerContext("TimePickerFooter");
	const popup = React.useContext(SurfaceContext) === "popup";
	return (
		<div ref={ref} data-slot="time-picker-footer" className={cn("flex items-center justify-between gap-2 border-t p-1.5", className)} {...props}>
			{children === undefined ? (
				<>
					<TimePickerNow />
					<TimePickerClear />
					{popup || context.requireConfirm ? <TimePickerConfirm /> : null}
				</>
			) : (
				children
			)}
		</div>
	);
});

export type TimePickerActionProps = React.ComponentPropsWithoutRef<typeof Button>;

/** Sets the current time, floored to the steps and moved inside the bounds. */
const TimePickerNow = React.forwardRef<HTMLElement, TimePickerActionProps>(function TimePickerNow(
	{ variant = "ghost", size = "sm", onClick, children, ...props },
	ref,
): React.JSX.Element {
	const context = useTimePickerContext("TimePickerNow");
	const contextRef = React.useRef(context);
	React.useLayoutEffect((): void => {
		contextRef.current = context;
	});
	const handleClick = React.useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>): void => {
			onClick?.(event);
			if (!event.defaultPrevented) {
				pickNow(contextRef.current);
			}
		},
		[onClick],
	);
	return (
		<Button ref={ref} type="button" variant={variant} size={size} disabled={context.disabled || context.readOnly} data-slot="time-picker-now" onClick={handleClick} {...props}>
			{children === undefined ? context.i18n.labels.now : children}
		</Button>
	);
});

/** Empties the value, then hands focus to the first column. */
const TimePickerClear = React.forwardRef<HTMLElement, TimePickerActionProps>(function TimePickerClear(
	{ variant = "ghost", size = "sm", className, onClick, children, ...props },
	ref,
): React.JSX.Element {
	const context = useTimePickerContext("TimePickerClear");
	const contextRef = React.useRef(context);
	React.useLayoutEffect((): void => {
		contextRef.current = context;
	});
	const handleClick = React.useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>): void => {
			onClick?.(event);
			if (event.defaultPrevented) {
				return;
			}
			contextRef.current.select(null);
			contextRef.current.getColumns()?.querySelector<HTMLElement>(LIST_SELECTOR)?.focus({ preventScroll: true });
		},
		[onClick],
	);
	return (
		<Button
			ref={ref}
			type="button"
			variant={variant}
			size={size}
			disabled={context.disabled || context.readOnly}
			data-slot="time-picker-clear"
			className={cn("text-muted-foreground", className)}
			onClick={handleClick}
			{...props}>
			{children === undefined ? context.i18n.labels.clear : children}
		</Button>
	);
});

/** Commits a pending draft and closes the popover. */
const TimePickerConfirm = React.forwardRef<HTMLElement, TimePickerActionProps>(function TimePickerConfirm(
	{ variant, size = "sm", onClick, children, ...props },
	ref,
): React.JSX.Element {
	const context = useTimePickerContext("TimePickerConfirm");
	const contextRef = React.useRef(context);
	React.useLayoutEffect((): void => {
		contextRef.current = context;
	});
	const handleClick = React.useCallback(
		(event: BaseUIEvent<React.MouseEvent<HTMLButtonElement>>): void => {
			onClick?.(event);
			if (!event.defaultPrevented) {
				contextRef.current.confirm();
			}
		},
		[onClick],
	);
	return (
		<Button
			ref={ref}
			type="button"
			variant={variant ?? (context.requireConfirm ? "default" : "secondary")}
			size={size}
			disabled={context.disabled}
			data-slot="time-picker-confirm"
			onClick={handleClick}
			{...props}>
			{children === undefined ? context.i18n.labels.confirm : children}
		</Button>
	);
});

export {
	TimePicker,
	TimePickerClear,
	TimePickerColumn,
	TimePickerColumns,
	TimePickerConfirm,
	TimePickerContent,
	TimePickerFooter,
	TimePickerInput,
	TimePickerNow,
	TimePickerPanel,
	TimePickerTrigger,
	TimePickerValue,
	timePickerInputVariants,
	timePickerPanelVariants,
	timePickerTriggerVariants,
};
