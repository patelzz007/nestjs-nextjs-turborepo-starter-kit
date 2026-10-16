// A single choice from a short list (Appearance, App lock timeout). Generic
// over the option value, controlled and data-agnostic: `value` in,
// `onChange(next)` out. Variants, sizes and states come from CVA over design
// tokens; `state` is derived by `resolveControlState`.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type NativeSyntheticEvent, type TargetedEvent } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState, type ControlState } from "../lib/control-state";
import type { ValueHandler } from "../lib/value-handler";

/** The group: its rows stacked. */
export const radioGroupVariants = cva("", {
	variants: {
		/** `default`: bare rows in a form. `card`: each option a bordered tile. */
		variant: { default: "gap-1", card: "gap-2" },
		size: { md: "", sm: "" },
		state: { default: "", loading: "opacity-60", disabled: "opacity-60", error: "" },
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

/** One option's pressable row. */
export const radioItemVariants = cva("min-h-11 flex-row items-center gap-3 py-2 active:opacity-80", {
	variants: {
		variant: {
			default: "",
			card: "rounded-xl border border-border bg-card px-3.5",
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
		selected: { true: "border-primary", false: "border-input" },
		state: { default: "", loading: "", disabled: "", error: "border-destructive" },
	},
	defaultVariants: { size: "md", selected: false, state: "default" },
});

/** The dot inside a chosen ring. */
export const radioDotVariants = cva("rounded-full bg-primary", {
	variants: { size: { md: "size-3", sm: "size-2.5" } },
	defaultVariants: { size: "md" },
});

const radioLabelVariants = cva("font-sans text-foreground", {
	variants: { size: { md: "text-base", sm: "text-sm" } },
	defaultVariants: { size: "md" },
});

type RadioGroupVariantProps = VariantProps<typeof radioGroupVariants>;
export type RadioGroupVariant = NonNullable<RadioGroupVariantProps["variant"]>;
export type RadioGroupSize = NonNullable<RadioGroupVariantProps["size"]>;

/** Option values are strings or numbers (an enum, a timeout in ms). */
export type RadioValue = string | number;

export interface RadioOption<TValue extends RadioValue> {
	readonly value: TValue;
	readonly label: string;
	readonly description?: string;
	/** This one option cannot be chosen (the rest still can). */
	readonly disabled?: boolean;
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
	/** Extra classes for the group, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** `RadioGroup` keeps its option type through `memo` and `forwardRef`. */
export interface RadioGroupComponent {
	<TValue extends RadioValue>(props: RadioGroupProps<TValue> & React.RefAttributes<View>): React.ReactNode;
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
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={option.label}
			accessibilityHint={option.description}
			accessibilityState={accessibilityState}
			disabled={isDisabled}
			onPress={handlePress}
			onFocus={onFocus}
			onBlur={onBlur}
			className={radioItemVariants({ variant, selected, disabled: option.disabled === true && !groupInactive })}>
			<View className={radioIndicatorVariants({ size, selected, state })}>{selected ? <View className={radioDotVariants({ size })} /> : null}</View>
			<View className="flex-1 gap-0.5">
				<Text className={radioLabelVariants({ size })}>{option.label}</Text>
				{option.description === undefined ? null : <Text className="font-sans text-sm text-muted-foreground">{option.description}</Text>}
			</View>
		</Pressable>
	);
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
			disabled = false,
			loading = false,
			invalid = false,
			className,
			testID,
		}: RadioGroupProps<RadioValue>,
		ref: React.ForwardedRef<View>,
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
				className={cn(radioGroupVariants({ variant, size, state }), className)}>
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
						onSelect={onChange}
						onFocus={onFocus}
						onBlur={onBlur}
					/>
				))}
			</View>
		);
	}),
);
