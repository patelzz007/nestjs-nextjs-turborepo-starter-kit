// A labelled checkbox. Controlled and data-agnostic: `checked` in,
// `onChange(next)` out. Variants, sizes and states come from CVA over design
// tokens only; `state` is derived by `resolveControlState` (disabled, then
// loading, then the caller's `invalid`).

import { cva, type VariantProps } from "class-variance-authority";
import CheckIcon from "lucide-react-native/icons/check";
import * as React from "react";
import { Pressable, Text, View, type NativeSyntheticEvent, type TargetedEvent } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Icon } from "./icon";

/** The pressable row: the box, then the label. */
export const checkboxVariants = cva("min-h-11 flex-row items-center gap-3 py-2 active:opacity-80", {
	variants: {
		/** `default`: a bare row in a form. `card`: a bordered tile that stands on its own. */
		variant: {
			default: "",
			card: "rounded-xl border border-border bg-card px-3.5",
		},
		size: {
			md: "",
			sm: "gap-2.5",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

/** The box itself: filled while checked, outlined in the error colour while invalid. */
export const checkboxBoxVariants = cva("items-center justify-center border-2", {
	variants: {
		size: {
			md: "size-6 rounded-md",
			sm: "size-5 rounded",
		},
		checked: {
			true: "border-primary bg-primary",
			false: "border-input bg-card",
		},
		state: {
			default: "",
			loading: "",
			disabled: "",
			error: "border-destructive",
		},
	},
	defaultVariants: { size: "md", checked: false, state: "default" },
});

export const checkboxLabelVariants = cva("font-sans text-foreground", {
	variants: {
		size: { md: "text-base", sm: "text-sm" },
	},
	defaultVariants: { size: "md" },
});

type CheckboxVariantProps = VariantProps<typeof checkboxVariants>;
export type CheckboxVariant = NonNullable<CheckboxVariantProps["variant"]>;
export type CheckboxSize = NonNullable<CheckboxVariantProps["size"]>;

export interface CheckboxProps {
	/** Visible label and the checkbox's accessible name. */
	readonly label: string;
	/** A second line under the label. */
	readonly description?: string;
	readonly checked: boolean;
	readonly onChange: (checked: boolean) => void;
	readonly onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly variant?: CheckboxVariant;
	readonly size?: CheckboxSize;
	readonly disabled?: boolean;
	/** The change is being saved: blocks presses and announces busy. */
	readonly loading?: boolean;
	/** The caller's validation outcome (a required consent left unchecked). */
	readonly invalid?: boolean;
	readonly accessibilityHint?: string;
	/** Extra classes for the row, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const Checkbox = React.memo(
	React.forwardRef<View, CheckboxProps>(function Checkbox(
		{
			label,
			description,
			checked,
			onChange,
			onFocus,
			onBlur,
			variant = "default",
			size = "md",
			disabled = false,
			loading = false,
			invalid = false,
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ checked, disabled: isInactive, busy: loading }), [checked, isInactive, loading]);
		const handlePress = React.useCallback((): void => {
			onChange(!checked);
		}, [checked, onChange]);
		return (
			<Pressable
				ref={ref}
				accessibilityRole="checkbox"
				accessibilityLabel={label}
				accessibilityHint={accessibilityHint ?? description}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={handlePress}
				onFocus={onFocus}
				onBlur={onBlur}
				testID={testID}
				className={cn(checkboxVariants({ variant, size, state }), className)}>
				<View className={checkboxBoxVariants({ size, checked, state })}>
					{checked ? <Icon icon={CheckIcon} size="sm" weight="bold" colorClassName="accent-primary-foreground" /> : null}
				</View>
				<View className="flex-1 gap-0.5">
					<Text className={checkboxLabelVariants({ size })}>{label}</Text>
					{description === undefined ? null : <Text className="font-sans text-sm text-muted-foreground">{description}</Text>}
				</View>
			</Pressable>
		);
	}),
);
