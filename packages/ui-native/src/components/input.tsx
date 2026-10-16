// A single-line text input. Controlled and data-agnostic: it shows the value it
// is given and reports every change; validation lives in the form's zod schema
// (rules/06, rules/07). The standard input contract maps onto React Native's:
// onChange(value) ← onChangeText, onBlur(), onFocus().
//
// The visible box is a `View` (border, background, addons, the loading
// spinner); the ref reaches the `TextInput` inside it, so a form can focus it.
// Inside a `Field`, the input is named by the field's label, described by its
// hint and takes its state (./field.tsx); its own props win.
//
// Whether the input has focus is display state (it only moves the border).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, TextInput, View, type TextInputProps } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { useFieldContext } from "./field";

/** The box around the text: border, fill, height, padding. */
export const inputVariants = cva("flex-row gap-2", {
	variants: {
		/** `default`: the outlined input. `ghost`: no border or fill, for an input inside another surface. */
		variant: {
			default: "border border-input bg-card",
			ghost: "border border-transparent bg-transparent",
		},
		size: {
			sm: "min-h-10 rounded-lg px-3",
			md: "min-h-12 rounded-xl px-3.5",
			lg: "min-h-14 rounded-xl px-4",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border-destructive",
		},
		focused: {
			true: "",
			false: "",
		},
		/** Several lines: the text starts at the top and the addons align with the first line. */
		multiline: {
			true: "items-start",
			false: "items-center",
		},
	},
	compoundVariants: [
		// Focus shows on an outlined input only, and an error outranks it.
		{ variant: "default", state: "default", focused: true, className: "border-ring" },
	],
	defaultVariants: { variant: "default", size: "md", state: "default", focused: false, multiline: false },
});

/** The typed text itself. */
export const inputTextVariants = cva("flex-1 self-stretch font-sans text-foreground", {
	variants: {
		size: {
			sm: "py-2 text-sm",
			md: "py-3 text-base",
			lg: "py-3.5 text-lg",
		},
	},
	defaultVariants: { size: "md" },
});

type InputVariantProps = VariantProps<typeof inputVariants>;
export type InputVariant = NonNullable<InputVariantProps["variant"]>;
export type InputSize = NonNullable<InputVariantProps["size"]>;

type PassThroughInputProps = Pick<
	TextInputProps,
	| "autoCapitalize"
	| "autoComplete"
	| "autoCorrect"
	| "autoFocus"
	| "keyboardType"
	| "maxLength"
	| "returnKeyType"
	| "secureTextEntry"
	| "textContentType"
	| "onSubmitEditing"
	| "placeholder"
	| "selectTextOnFocus"
	| "accessibilityHint"
	| "accessibilityLabel"
>;

export interface InputProps extends PassThroughInputProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	/** Input shaping applied before `onChange` (digits only, upper case) — never validation, which is the schema's job. */
	readonly normalize?: ((value: string) => string) | undefined;
	readonly onBlur?: (() => void) | undefined;
	readonly onFocus?: (() => void) | undefined;
	readonly variant?: InputVariant | undefined;
	readonly size?: InputSize | undefined;
	/** The caller's validation outcome. Inside a `Field`, defaults to the field's. */
	readonly invalid?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** Work is in flight (a lookup on this value): shows a spinner and takes no input. */
	readonly loading?: boolean | undefined;
	/** Several lines (prefer `Textarea`). */
	readonly multiline?: boolean | undefined;
	/** Content before the text, inside the box (prefer `InputGroup`). */
	readonly leading?: React.ReactNode | undefined;
	/** Content after the text, inside the box (prefer `InputGroup`). */
	readonly trailing?: React.ReactNode | undefined;
	/** Extra classes for the box, merged last (layout: `flex-1`; a taller `min-h-*`). */
	readonly className?: string | undefined;
	/** Set on the `TextInput`. */
	readonly testID?: string | undefined;
}

export const Input = React.memo(
	React.forwardRef<TextInput, InputProps>(function Input(
		{
			value,
			onChange,
			normalize,
			onBlur,
			onFocus,
			variant = "default",
			size = "md",
			invalid,
			disabled,
			loading,
			multiline = false,
			secureTextEntry = false,
			leading,
			trailing,
			accessibilityLabel,
			accessibilityHint,
			className,
			testID,
			...inputProps
		},
		ref,
	): React.JSX.Element {
		const field = useFieldContext();
		const isLoading = loading ?? field?.loading ?? false;
		const state = resolveControlState({
			disabled: disabled ?? field?.disabled,
			loading: isLoading,
			invalid: invalid ?? field?.invalid,
		});
		const isInactive = isInactiveState(state);
		const [isFocused, setFocused] = React.useState(false);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: isLoading }), [isInactive, isLoading]);

		const handleChangeText = React.useCallback(
			(text: string): void => {
				onChange(normalize === undefined ? text : normalize(text));
			},
			[normalize, onChange],
		);
		const handleFocus = React.useCallback((): void => {
			setFocused(true);
			onFocus?.();
		}, [onFocus]);
		const handleBlur = React.useCallback((): void => {
			setFocused(false);
			onBlur?.();
		}, [onBlur]);

		return (
			<View className={cn(inputVariants({ variant, size, state, focused: isFocused, multiline }), className)}>
				{leading}
				<TextInput
					ref={ref}
					accessibilityLabel={accessibilityLabel ?? field?.label}
					accessibilityHint={accessibilityHint ?? field?.hint}
					accessibilityLabelledBy={accessibilityLabel === undefined ? field?.labelId : undefined}
					accessibilityState={accessibilityState}
					value={value}
					onChangeText={handleChangeText}
					onFocus={handleFocus}
					onBlur={handleBlur}
					editable={!isInactive}
					secureTextEntry={secureTextEntry}
					multiline={multiline}
					textAlignVertical={multiline ? "top" : "center"}
					placeholderTextColorClassName="accent-muted-foreground"
					testID={testID}
					className={inputTextVariants({ size })}
					{...inputProps}
				/>
				{isLoading ? <ActivityIndicator size="small" colorClassName="accent-muted-foreground" /> : null}
				{trailing}
			</View>
		);
	}),
);
