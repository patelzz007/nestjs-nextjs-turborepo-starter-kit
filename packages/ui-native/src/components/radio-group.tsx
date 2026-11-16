// A single choice from a short list (Appearance, App lock timeout). Generic
// over the option value, controlled and data-agnostic: `value` in,
// `onChange(next)` out. Variants, sizes and states come from CVA over design
// tokens; `state` is derived by `resolveControlState`.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { type NativeSyntheticEvent, Pressable, type TargetedEvent, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState, type ControlState } from "../lib/control-state";
import type { ValueHandler } from "../lib/value-handler";
import { ToggleMark, ToggleMarkScope } from "./toggle-mark";

/** The group: its rows stacked. */
export const radioGroupVariants = cva("", {
	variants: {
		/** `default`: bare rows in a form. `card`: each option a bordered tile. */
		variant: { default: "gap-1", card: "gap-2" },
		/** `horizontal`: options side by side, wrapping. `grid`: two columns of tiles. */
		orientation: { vertical: "", horizontal: "flex-row flex-wrap gap-x-4", grid: "flex-row flex-wrap" },
		size: { md: "", sm: "" },
		state: { default: "", loading: "opacity-60", disabled: "opacity-60", error: "" },
	},
	defaultVariants: { variant: "default", size: "md", orientation: "vertical", state: "default" },
});

/** One option's pressable row. */
export const radioItemVariants = cva("min-h-12 flex-row items-center gap-3 py-2.5 active:opacity-80", {
	variants: {
		variant: {
			default: "",
			card: "rounded-card border border-border bg-card px-4",
		},
		selected: { true: "", false: "" },
		disabled: { true: "opacity-60", false: "" },
	},
	compoundVariants: [{ variant: "card", selected: true, className: "border-primary" }],
	defaultVariants: { variant: "default", selected: false, disabled: false },
});

/** The ring: primary while chosen, the error colour while the group is invalid. */
export const radioIndicatorVariants = cva("items-center justify-center rounded-full border-2", {
	variants: {
		size: { md: "size-6", sm: "size-5" },
		selected: { true: "", false: "border-control-ring" },
		tone: { primary: "", blue: "", green: "", yellow: "" },
		state: { default: "", loading: "", disabled: "", error: "border-destructive" },
	},
	compoundVariants: [
		{ selected: true, tone: "primary", className: "border-primary" },
		{ selected: true, tone: "blue", className: "border-tone-blue" },
		{ selected: true, tone: "green", className: "border-tone-green" },
		{ selected: true, tone: "yellow", className: "border-tone-yellow" },
	],
	defaultVariants: { size: "md", selected: false, tone: "primary", state: "default" },
});

/** The dot inside a chosen ring. */
export const radioDotVariants = cva("rounded-full", {
	variants: {
		size: { md: "size-3", sm: "size-2.5" },
		tone: { primary: "bg-primary", blue: "bg-tone-blue", green: "bg-tone-green", yellow: "bg-tone-yellow" },
	},
	defaultVariants: { size: "md", tone: "primary" },
});

export type RadioTone = NonNullable<VariantProps<typeof radioDotVariants>["tone"]>;

const radioLabelVariants = cva("font-sans text-foreground", {
	variants: { size: { md: "text-body-lg", sm: "text-body" } },
	defaultVariants: { size: "md" },
});

type RadioGroupVariantProps = VariantProps<typeof radioGroupVariants>;
export type RadioGroupVariant = NonNullable<RadioGroupVariantProps["variant"]>;
export type RadioGroupSize = NonNullable<RadioGroupVariantProps["size"]>;
export type RadioGroupOrientation = NonNullable<RadioGroupVariantProps["orientation"]>;

/** Option values are strings or numbers (an enum, a timeout in ms). */
export type RadioValue = string | number;

export interface RadioOption<TValue extends RadioValue> {
	readonly value: TValue;
	readonly label: string;
	readonly description?: string;
	/** This one option cannot be chosen (the rest still can). */
	readonly disabled?: boolean;
	/** Before the label: an icon, an avatar, a card brand; decorative. */
	readonly leading?: React.ReactNode;
	/** After the label: a badge, a price, a help tooltip. */
	readonly trailing?: React.ReactNode;
}

export interface RadioGroupProps<TValue extends RadioValue> {
	/** The group's accessible name. */
	readonly label: string;
	readonly options: readonly RadioOption<TValue>[];
	/** The chosen option, or `null` while nothing is chosen yet. */
	readonly value: NoInfer<TValue> | null;
	readonly onChange: ValueHandler<TValue>;
	readonly onFocus?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly onBlur?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly variant?: RadioGroupVariant;
	readonly size?: RadioGroupSize;
	readonly disabled?: boolean;
	/** The choice is being saved: blocks presses and announces busy. */
	readonly loading?: boolean;
	/** The caller's validation outcome (a required choice left empty). */
	readonly invalid?: boolean;
	/** `horizontal`: side by side, wrapping. `grid`: two columns of tiles. */
	readonly orientation?: RadioGroupOrientation | undefined;
	/** The chosen ring's colour: `primary` (default), or a categorical tone. */
	readonly tone?: RadioTone | undefined;
	/** `end`: the ring at the row's end (a list of plans). */
	readonly controlPosition?: "start" | "end" | undefined;
	/** Extra classes for the group, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** `RadioGroup` keeps its option type through `memo` and `forwardRef`. */
export interface RadioGroupComponent {
	<TValue extends RadioValue>(props: RadioGroupProps<TValue> & React.RefAttributes<ViewInstance>): React.ReactNode;
	displayName?: string | undefined;
}

interface RadioRowProps {
	readonly option: RadioOption<RadioValue>;
	readonly selected: boolean;
	readonly groupInactive: boolean;
	readonly loading: boolean;
	readonly state: ControlState;
	readonly variant: RadioGroupVariant;
	readonly size: RadioGroupSize;
	readonly tone: RadioTone;
	readonly controlPosition: "start" | "end";
	/** A grid tile takes half the row. */
	readonly tile: boolean;
	readonly onSelect: ValueHandler<RadioValue>;
	readonly onFocus: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly onBlur: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
}

const RadioRow = React.memo(function RadioRow({
	option,
	selected,
	groupInactive,
	loading,
	state,
	variant,
	size,
	tone,
	controlPosition,
	tile,
	onSelect,
	onFocus,
	onBlur,
}: RadioRowProps): React.JSX.Element {
	const isDisabled = groupInactive || option.disabled === true;
	const accessibilityState = React.useMemo(() => ({ checked: selected, disabled: isDisabled, busy: loading }), [isDisabled, loading, selected]);
	const handlePress = React.useCallback((): void => {
		if (!selected) {
			onSelect(option.value);
		}
	}, [onSelect, option.value, selected]);
	// The dot pops in when chosen (toggle-mark.tsx); the one shown at first stays still.
	const ring = (
		<ToggleMarkScope className={radioIndicatorVariants({ size, selected, tone, state })}>
			{selected ? <ToggleMark className={radioDotVariants({ size, tone })} /> : null}
		</ToggleMarkScope>
	);
	const row = (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={option.label}
			accessibilityHint={option.description}
			accessibilityState={accessibilityState}
			disabled={isDisabled}
			onPress={handlePress}
			onFocus={onFocus}
			onBlur={onBlur}
			className={cn(radioItemVariants({ variant, selected, disabled: option.disabled === true && !groupInactive }), tile ? "flex-1 flex-col items-start" : undefined)}>
			{controlPosition === "start" ? ring : null}
			{option.leading}
			<View className={tile ? "gap-0.5" : "flex-1 gap-0.5"}>
				<View className="flex-row flex-wrap items-center gap-2">
					<Text className={radioLabelVariants({ size })}>{option.label}</Text>
					{option.trailing}
				</View>
				{option.description === undefined ? null : <Text className="text-body font-sans text-muted-foreground">{option.description}</Text>}
			</View>
			{controlPosition === "end" ? ring : null}
		</Pressable>
	);
	// A grid tile: half the row, the gap as padding so two tiles sit side by side.
	return tile ? <View className="w-1/2 p-1">{row}</View> : row;
});

export const RadioGroup: RadioGroupComponent = React.memo(
	React.forwardRef(function RadioGroup(
		{
			label,
			options,
			value,
			onChange,
			onFocus,
			onBlur,
			variant = "default",
			size = "md",
			orientation = "vertical",
			tone = "primary",
			controlPosition = "start",
			disabled = false,
			loading = false,
			invalid = false,
			className,
			testID,
		}: RadioGroupProps<RadioValue>,
		ref: React.ForwardedRef<ViewInstance>,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);
		return (
			<View
				ref={ref}
				accessibilityRole="radiogroup"
				accessibilityLabel={label}
				accessibilityState={accessibilityState}
				testID={testID}
				className={cn(radioGroupVariants({ variant, size, orientation, state }), className)}>
				{options.map((option: RadioOption<RadioValue>): React.JSX.Element => (
					<RadioRow
						key={String(option.value)}
						option={option}
						selected={option.value === value}
						groupInactive={isInactive}
						loading={loading}
						state={state}
						variant={variant}
						size={size}
						tone={tone}
						controlPosition={controlPosition}
						tile={orientation === "grid"}
						onSelect={onChange}
						onFocus={onFocus}
						onBlur={onBlur}
					/>
				))}
			</View>
		);
	}),
);
