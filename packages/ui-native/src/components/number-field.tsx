// A number typed or stepped (the web kit's `NumberField`): a numeric field
// with a minus and a plus, the value clamped to `min`…`max` and snapped to
// `step`. Typing is free while the field has focus; the text is read back as
// a number when it loses focus (an empty or unreadable text clears the value,
// `null`). Controlled: `value` in, `onChange(next)` out.
//
// Three layouts: `split` (minus · value · plus, the value centred), `end`
// (the value, then minus and plus together) and `spinner` (the value, then
// small up and down chevrons stacked). Screen readers hear the field as
// adjustable: swiping up or down steps it, as the buttons do. Inside a `Field`
// it takes the field's label and state.

import { cva, type VariantProps } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import MinusIcon from "lucide-react-native/icons/minus";
import PlusIcon from "lucide-react-native/icons/plus";
import * as React from "react";
import { type AccessibilityActionEvent, Pressable, TextInput, type TextInputInstance, View } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { FIELD_SURFACE_FILL, useFieldSurface } from "../lib/field-surface";
import { useFieldContext } from "./field";
import { Icon, type LucideIcon } from "./icon";

export const numberFieldVariants = cva("rounded-button flex-row items-stretch overflow-hidden border", {
	variants: {
		size: { sm: "min-h-10", md: "min-h-12", lg: "min-h-14" },
		state: { default: "border-input", loading: "border-input opacity-60", disabled: "border-input opacity-60", error: "border-destructive" },
		surface: { page: FIELD_SURFACE_FILL.page, card: FIELD_SURFACE_FILL.card, popover: FIELD_SURFACE_FILL.popover },
	},
	defaultVariants: { size: "md", state: "default", surface: "page" },
});

export const numberFieldInputVariants = cva("flex-1 font-sans text-foreground tabular-nums", {
	variants: {
		size: { sm: "text-body px-3", md: "text-body-lg px-3.5", lg: "text-h3 px-4" },
		layout: { split: "text-center", end: "text-left", spinner: "text-left" },
	},
	defaultVariants: { size: "md", layout: "split" },
});

export const numberFieldButtonVariants = cva("active:bg-surface-selected items-center justify-center", {
	variants: {
		size: { sm: "w-10", md: "w-12", lg: "w-14" },
	},
	defaultVariants: { size: "md" },
});

type NumberFieldVariantProps = VariantProps<typeof numberFieldVariants>;
export type NumberFieldSize = NonNullable<NumberFieldVariantProps["size"]>;
/** Where the steppers sit: around the value, together after it, or stacked as a spinner after it. */
export type NumberFieldLayout = "split" | "end" | "spinner";

/** The field's default names; generic and overridable. */
export interface NumberFieldLabels {
	readonly decrement: string;
	readonly increment: string;
}

export const DEFAULT_NUMBER_FIELD_LABELS: NumberFieldLabels = { decrement: "Decrease", increment: "Increase" };

/** `value` kept within `min`…`max` and snapped to the nearest `step` from `min` (or from 0). */
export function clampToStep(value: number, min: number | undefined, max: number | undefined, step: number): number {
	const origin = min ?? 0;
	const snapped = origin + Math.round((value - origin) / step) * step;
	// Floating steps (0.1) leave noise: keep as many decimals as the step has.
	const decimals = (String(step).split(".").at(1) ?? "").length;
	const rounded = Number(snapped.toFixed(decimals));
	return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, rounded));
}

/** The number a typed text means, or `null` when it is empty or not a number. */
export function parseNumberText(text: string): number | null {
	const trimmed = text.trim().replace(/,/gu, "");
	if (trimmed.length === 0) {
		return null;
	}
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

export interface NumberFieldProps {
	readonly value: number | null;
	readonly onChange: (value: number | null) => void;
	readonly min?: number | undefined;
	readonly max?: number | undefined;
	/** How far a press of minus or plus moves the value, and what a typed value snaps to. Default 1. */
	readonly step?: number | undefined;
	/** How the value is written in the field (a currency, a unit); typing shows the plain number. */
	readonly formatValue?: ((value: number) => string) | undefined;
	readonly layout?: NumberFieldLayout | undefined;
	readonly size?: NumberFieldSize | undefined;
	readonly placeholder?: string | undefined;
	/** The field's name, when it is not inside a `Field` with a label. */
	readonly accessibilityLabel?: string | undefined;
	readonly labels?: Partial<NumberFieldLabels> | undefined;
	readonly invalid?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	readonly loading?: boolean | undefined;
	readonly onFocus?: (() => void) | undefined;
	readonly onBlur?: (() => void) | undefined;
	/** Extra classes for the box, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

interface StepButtonProps {
	readonly icon: LucideIcon;
	readonly label: string;
	readonly disabled: boolean;
	readonly onPress: () => void;
	readonly className: string;
}

const StepButton = React.memo(function StepButton({ icon, label, disabled, onPress, className }: StepButtonProps): React.JSX.Element {
	const accessibilityState = React.useMemo(() => ({ disabled }), [disabled]);
	return (
		<Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={accessibilityState} disabled={disabled} onPress={onPress} className={className}>
			<Icon icon={icon} size="sm" colorClassName={disabled ? "accent-text-tertiary" : "accent-icon"} />
		</Pressable>
	);
});

/** The adjustable role's two gestures, as screen readers name them. */
const ADJUSTABLE_ACTIONS: readonly { readonly name: "increment" | "decrement" }[] = [{ name: "increment" }, { name: "decrement" }];

export const NumberField = React.memo(
	React.forwardRef<TextInputInstance, NumberFieldProps>(function NumberField(
		{
			value,
			onChange,
			min,
			max,
			step = 1,
			formatValue,
			layout = "split",
			size = "md",
			placeholder,
			accessibilityLabel,
			labels,
			invalid,
			disabled,
			loading,
			onFocus,
			onBlur,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const field = useFieldContext();
		const surface = useFieldSurface();
		const names = React.useMemo((): NumberFieldLabels => ({ ...DEFAULT_NUMBER_FIELD_LABELS, ...labels }), [labels]);
		const state = resolveControlState({ disabled: disabled ?? field?.disabled, loading: loading ?? field?.loading, invalid: invalid ?? field?.invalid });
		const isInactive = isInactiveState(state);
		const [draft, setDraft] = React.useState<string | null>(null);
		const shown = draft ?? (value === null ? "" : (formatValue?.(value) ?? String(value)));

		const stepBy = React.useCallback(
			(direction: 1 | -1): void => {
				const base = value ?? min ?? 0;
				onChange(clampToStep(value === null ? base : base + direction * step, min, max, step));
			},
			[max, min, onChange, step, value],
		);
		const decrement = React.useCallback((): void => {
			stepBy(-1);
		}, [stepBy]);
		const increment = React.useCallback((): void => {
			stepBy(1);
		}, [stepBy]);
		const startTyping = React.useCallback((): void => {
			setDraft(value === null ? "" : String(value));
			onFocus?.();
		}, [onFocus, value]);
		const commit = React.useCallback((): void => {
			if (draft !== null) {
				const parsed = parseNumberText(draft);
				onChange(parsed === null ? null : clampToStep(parsed, min, max, step));
			}
			setDraft(null);
			onBlur?.();
		}, [draft, max, min, onBlur, onChange, step]);
		const onAccessibilityAction = React.useCallback(
			(event: AccessibilityActionEvent): void => {
				if (event.nativeEvent.actionName === "increment") {
					increment();
				} else if (event.nativeEvent.actionName === "decrement") {
					decrement();
				}
			},
			[decrement, increment],
		);

		const atMin = value !== null && min !== undefined && value <= min;
		const atMax = value !== null && max !== undefined && value >= max;
		const buttonClass = numberFieldButtonVariants({ size });
		const minus = (
			<StepButton icon={MinusIcon} label={names.decrement} disabled={isInactive || atMin} onPress={decrement} className={cn(buttonClass, "border-r border-input")} />
		);
		const plus = (
			<StepButton
				icon={PlusIcon}
				label={names.increment}
				disabled={isInactive || atMax}
				onPress={increment}
				className={cn(buttonClass, layout === "split" ? "border-l border-input" : "border-l border-input")}
			/>
		);
		const accessibilityValue = React.useMemo(
			() => (value === null ? {} : { now: value, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }), text: formatValue?.(value) ?? String(value) }),
			[formatValue, max, min, value],
		);
		const input = (
			<TextInput
				ref={ref}
				value={shown}
				onChangeText={setDraft}
				onFocus={startTyping}
				onBlur={commit}
				editable={!isInactive}
				keyboardType="decimal-pad"
				returnKeyType="done"
				placeholder={placeholder}
				placeholderTextColorClassName="accent-muted-foreground"
				accessibilityLabel={accessibilityLabel ?? field?.label}
				accessibilityHint={field?.hint}
				accessibilityRole="adjustable"
				accessibilityValue={accessibilityValue}
				accessibilityActions={ADJUSTABLE_ACTIONS}
				onAccessibilityAction={onAccessibilityAction}
				testID={testID}
				className={numberFieldInputVariants({ size, layout })}
			/>
		);
		return (
			<View className={cn(numberFieldVariants({ size, state, surface }), className)}>
				{layout === "split" ? minus : null}
				{input}
				{layout === "end" ? (
					<>
						<StepButton icon={MinusIcon} label={names.decrement} disabled={isInactive || atMin} onPress={decrement} className={cn(buttonClass, "border-l border-input")} />
						{plus}
					</>
				) : null}
				{layout === "split" ? plus : null}
				{layout === "spinner" ? (
					<View className="w-10 border-l border-input">
						<StepButton
							icon={ChevronUpIcon}
							label={names.increment}
							disabled={isInactive || atMax}
							onPress={increment}
							className="active:bg-surface-selected flex-1 items-center justify-center border-b border-input"
						/>
						<StepButton
							icon={ChevronDownIcon}
							label={names.decrement}
							disabled={isInactive || atMin}
							onPress={decrement}
							className="active:bg-surface-selected flex-1 items-center justify-center"
						/>
					</View>
				) : null}
			</View>
		);
	}),
);
