// A set of toggle chips read as one choice: `type="single"` picks one (a
// screen reader hears a radio group), `type="multiple"` picks any number
// (each chip a checkbox). Generic over the option value, controlled and
// data-agnostic: `value` in, `onChange(next)` out — the caller owns the
// options and the choice. Styled with `Toggle`'s variants, so a chip in a
// group looks like a standalone `Toggle`.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View, type NativeSyntheticEvent, type TargetedEvent } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState, type ControlState } from "../lib/control-state";
import { playSelectionFeedback } from "../lib/haptics";
import type { ValueHandler } from "../lib/value-handler";
import { Icon, type LucideIcon } from "./icon";
import { TOGGLE_ICON_SIZE, TOGGLE_SMALL_HIT_SLOP, toggleContentColorOf, toggleLabelVariants, toggleVariants, type ToggleSize, type ToggleVariant } from "./toggle";

export const toggleGroupVariants = cva("flex-row flex-wrap", {
	variants: {
		variant: { default: "", outline: "" },
		size: { sm: "gap-1.5", md: "gap-2", lg: "gap-2" },
		state: { default: "", loading: "", disabled: "", error: "" },
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

type ToggleGroupVariantProps = VariantProps<typeof toggleGroupVariants>;
export type ToggleGroupVariant = NonNullable<ToggleGroupVariantProps["variant"]>;
export type ToggleGroupSize = NonNullable<ToggleGroupVariantProps["size"]>;

export interface ToggleGroupOption<TValue extends string> {
	readonly value: TValue;
	/** What the chip shows, and its accessible name. */
	readonly label: string;
	/** A glyph before the label; decorative. */
	readonly icon?: LucideIcon;
	/** What screen readers say, when the label is shorthand. */
	readonly accessibilityLabel?: string;
	/** This one chip cannot be pressed. */
	readonly disabled?: boolean;
}

type FocusHandler = (event: NativeSyntheticEvent<TargetedEvent>) => void;

interface ToggleGroupBaseProps<TValue extends string> {
	/** The group's accessible name ("Text style"). */
	readonly label: string;
	readonly options: readonly ToggleGroupOption<TValue>[];
	readonly onFocus?: FocusHandler | undefined;
	readonly onBlur?: FocusHandler | undefined;
	/** Show only the glyphs (labels still name the chips for screen readers). Every option needs an `icon`. */
	readonly hideLabels?: boolean;
	readonly variant?: ToggleGroupVariant;
	readonly size?: ToggleGroupSize;
	readonly disabled?: boolean;
	/** The change is being saved: blocks presses and announces busy. */
	readonly loading?: boolean;
	/** The caller's validation outcome. */
	readonly invalid?: boolean;
	/** Extra classes for the group, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** One chip at most. */
export interface ToggleGroupSingleProps<TValue extends string> extends ToggleGroupBaseProps<TValue> {
	readonly type: "single";
	/** The pressed chip, or `null` while none is. (`TValue` is inferred from `options` only: see `ToggleGroupProps`.) */
	readonly value: NoInfer<TValue> | null;
	/** `null` only when `deselectable` and the pressed chip is pressed again. */
	readonly onChange: ValueHandler<TValue | null>;
	/** Pressing the pressed chip again releases it (as the web kit's single group does). Off: it stays, like a radio. */
	readonly deselectable?: boolean;
}

/** Any number of chips. */
export interface ToggleGroupMultipleProps<TValue extends string> extends ToggleGroupBaseProps<TValue> {
	readonly type: "multiple";
	readonly value: readonly NoInfer<TValue>[];
	/** The new set of pressed chips, in the options' order. */
	readonly onChange: ValueHandler<readonly TValue[]>;
}

/**
 * Either mode's props. `TValue` is inferred from `options` alone: inferred
 * from `value` too, a multiple group's array would also be tried as the
 * single mode's value and widen `TValue` to `string`.
 */
export type ToggleGroupProps<TValue extends string> = ToggleGroupSingleProps<TValue> | ToggleGroupMultipleProps<TValue>;

/** `ToggleGroup` keeps its option type through `memo` and `forwardRef`. */
export interface ToggleGroupComponent {
	<TValue extends string>(props: ToggleGroupProps<TValue> & React.RefAttributes<View>): React.ReactNode;
	displayName?: string | undefined;
}

/** The pressed values after `value` is pressed in a multiple group, in the options' order. */
export function toggleGroupValues<TValue extends string>(options: readonly ToggleGroupOption<TValue>[], pressed: readonly TValue[], value: TValue): readonly TValue[] {
	const next = pressed.includes(value) ? pressed.filter((item: TValue): boolean => item !== value) : [...pressed, value];
	return options.map((option: ToggleGroupOption<TValue>): TValue => option.value).filter((item: TValue): boolean => next.includes(item));
}

interface ToggleGroupItemProps {
	readonly option: ToggleGroupOption<string>;
	readonly pressed: boolean;
	readonly mode: ToggleGroupProps<string>["type"];
	readonly groupInactive: boolean;
	readonly loading: boolean;
	readonly state: ControlState;
	readonly hideLabel: boolean;
	readonly variant: ToggleVariant;
	readonly size: ToggleSize;
	readonly onToggle: ValueHandler<string>;
	readonly onFocus: FocusHandler | undefined;
	readonly onBlur: FocusHandler | undefined;
}

const ToggleGroupItem = React.memo(function ToggleGroupItem({
	option,
	pressed,
	mode,
	groupInactive,
	loading,
	state,
	hideLabel,
	variant,
	size,
	onToggle,
	onFocus,
	onBlur,
}: ToggleGroupItemProps): React.JSX.Element {
	const isDisabled = groupInactive || option.disabled === true;
	const accessibilityState = React.useMemo(() => ({ checked: pressed, disabled: isDisabled, busy: loading }), [isDisabled, loading, pressed]);
	const handlePress = React.useCallback((): void => {
		playSelectionFeedback();
		onToggle(option.value);
	}, [onToggle, option.value]);
	const contentColor = toggleContentColorOf(pressed);
	const itemState = option.disabled === true && state === "default" ? "disabled" : state;
	const showsLabel = !hideLabel || option.icon === undefined;
	return (
		<Pressable
			accessibilityRole={mode === "single" ? "radio" : "checkbox"}
			accessibilityLabel={option.accessibilityLabel ?? option.label}
			accessibilityState={accessibilityState}
			disabled={isDisabled}
			onPress={handlePress}
			onFocus={onFocus}
			onBlur={onBlur}
			hitSlop={size === "sm" ? TOGGLE_SMALL_HIT_SLOP : undefined}
			className={toggleVariants({ variant, size, pressed, state: itemState })}>
			{loading && pressed ? <ActivityIndicator size="small" colorClassName={contentColor} /> : null}
			{option.icon === undefined || (loading && pressed) ? null : <Icon icon={option.icon} size={TOGGLE_ICON_SIZE[size]} colorClassName={contentColor} />}
			{showsLabel ? (
				<Text numberOfLines={1} className={toggleLabelVariants({ size, pressed })}>
					{option.label}
				</Text>
			) : null}
		</Pressable>
	);
});

export const ToggleGroup: ToggleGroupComponent = React.memo(
	React.forwardRef(function ToggleGroup(props: ToggleGroupProps<string>, ref: React.ForwardedRef<View>): React.JSX.Element {
		const {
			label,
			options,
			onFocus,
			onBlur,
			hideLabels = false,
			variant = "default",
			size = "md",
			disabled = false,
			loading = false,
			invalid = false,
			className,
			testID,
		} = props;
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);
		const { type, value, onChange } = props;
		const deselectable = props.type === "single" && props.deselectable === true;
		const pressedValues = React.useMemo((): readonly string[] => {
			if (type === "multiple") {
				return value;
			}
			return value === null ? [] : [value];
		}, [type, value]);

		const toggle = React.useCallback(
			(pressedValue: string): void => {
				if (type === "multiple") {
					onChange(toggleGroupValues(options, value, pressedValue));
				} else if (pressedValue !== value) {
					onChange(pressedValue);
				} else if (deselectable) {
					onChange(null);
				}
			},
			[deselectable, onChange, options, type, value],
		);

		return (
			<View
				ref={ref}
				role={type === "single" ? "radiogroup" : "group"}
				accessibilityLabel={label}
				accessibilityState={accessibilityState}
				testID={testID}
				className={cn(toggleGroupVariants({ variant, size, state }), className)}>
				{options.map((option: ToggleGroupOption<string>): React.JSX.Element => (
					<ToggleGroupItem
						key={option.value}
						option={option}
						pressed={pressedValues.includes(option.value)}
						mode={type}
						groupInactive={isInactive}
						loading={loading}
						state={state}
						hideLabel={hideLabels}
						variant={variant}
						size={size}
						onToggle={toggle}
						onFocus={onFocus}
						onBlur={onBlur}
					/>
				))}
			</View>
		);
	}),
);
