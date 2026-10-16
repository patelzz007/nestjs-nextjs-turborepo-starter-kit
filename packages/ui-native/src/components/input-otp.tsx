// A one-time code input: `length` single-character cells drawn over ONE hidden
// `TextInput`, which owns the keyboard, the paste and the OS's SMS / password
// manager autofill (`oneTimeCode`). Controlled: the code string comes in as
// `value` and every change goes out through `onChange(value)`; `onComplete`
// fires when the last cell is filled. The ref reaches the `TextInput`.
//
// The cells are drawing only (hidden from screen readers): the input is the
// one accessible element, named by `accessibilityLabel` or the enclosing
// field's label. Whether it has focus is display state (it marks the active
// cell). The kit never validates the code; `normalize` only shapes it.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { useFieldContext } from "./field";

/** A TOTP / email code's usual length. */
const DEFAULT_OTP_LENGTH = 6;

export const inputOTPVariants = cva("flex-row", {
	variants: {
		variant: {
			default: "",
		},
		size: {
			sm: "gap-1.5",
			md: "gap-2",
			lg: "gap-2.5",
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

export const inputOTPCellVariants = cva("items-center justify-center rounded-lg border bg-card", {
	variants: {
		variant: {
			default: "border-input",
		},
		size: {
			sm: "h-10 w-8",
			md: "h-12 w-10",
			lg: "h-14 w-12",
		},
		state: {
			default: "",
			loading: "",
			disabled: "",
			error: "border-destructive",
		},
		active: {
			true: "",
			false: "",
		},
	},
	compoundVariants: [
		// The next cell to fill shows the focus ring; an error outranks it.
		{ state: "default", active: true, className: "border-ring" },
	],
	defaultVariants: { variant: "default", size: "md", state: "default", active: false },
});

export const inputOTPCharVariants = cva("font-sans-semibold text-foreground", {
	variants: {
		size: {
			sm: "text-base",
			md: "text-lg",
			lg: "text-xl",
		},
	},
	defaultVariants: { size: "md" },
});

type InputOTPVariantProps = VariantProps<typeof inputOTPVariants>;
export type InputOTPVariant = NonNullable<InputOTPVariantProps["variant"]>;
export type InputOTPSize = NonNullable<InputOTPVariantProps["size"]>;

export interface InputOTPProps {
	/** The code typed so far (at most `length` characters). */
	readonly value: string;
	readonly onChange: (value: string) => void;
	/** Called with the full code when the last cell is filled. */
	readonly onComplete?: ((value: string) => void) | undefined;
	readonly onBlur?: (() => void) | undefined;
	readonly onFocus?: (() => void) | undefined;
	/** Input shaping before `onChange` (digits only) — never validation. */
	readonly normalize?: ((value: string) => string) | undefined;
	/** How many cells. */
	readonly length?: number | undefined;
	readonly keyboardType?: TextInputProps["keyboardType"] | undefined;
	readonly autoFocus?: boolean | undefined;
	readonly variant?: InputOTPVariant | undefined;
	readonly size?: InputOTPSize | undefined;
	/** The caller's validation outcome. Inside a `Field`, defaults to the field's. */
	readonly invalid?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** The code is being checked: no input. */
	readonly loading?: boolean | undefined;
	/** The accessible name; inside a `Field`, defaults to the field's label. */
	readonly accessibilityLabel?: string | undefined;
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the row of cells, merged last. */
	readonly className?: string | undefined;
	/** Set on the hidden `TextInput`; each cell gets `<testID>-cell`. */
	readonly testID?: string | undefined;
}

export const InputOTP = React.memo(
	React.forwardRef<TextInput, InputOTPProps>(function InputOTP(
		{
			value,
			onChange,
			onComplete,
			onBlur,
			onFocus,
			normalize,
			length = DEFAULT_OTP_LENGTH,
			keyboardType = "number-pad",
			autoFocus,
			variant = "default",
			size = "md",
			invalid,
			disabled,
			loading,
			accessibilityLabel,
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const field = useFieldContext();
		const isLoading = loading ?? field?.loading ?? false;
		const state = resolveControlState({ disabled: disabled ?? field?.disabled, loading: isLoading, invalid: invalid ?? field?.invalid });
		const isInactive = isInactiveState(state);
		const [isFocused, setFocused] = React.useState(false);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: isLoading }), [isInactive, isLoading]);
		const cellIndexes = React.useMemo((): readonly number[] => Array.from({ length }, (_cell: undefined, index: number): number => index), [length]);

		const handleChangeText = React.useCallback(
			(text: string): void => {
				const shaped = (normalize === undefined ? text : normalize(text)).slice(0, length);
				onChange(shaped);
				if (shaped.length === length) {
					onComplete?.(shaped);
				}
			},
			[length, normalize, onChange, onComplete],
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
			<View className={cn(inputOTPVariants({ variant, size, state }), className)}>
				{cellIndexes.map((index: number): React.JSX.Element => (
					<View
						key={index}
						accessibilityElementsHidden
						importantForAccessibility="no-hide-descendants"
						testID={testID === undefined ? undefined : `${testID}-cell`}
						className={inputOTPCellVariants({ variant, size, state, active: isFocused && index === Math.min(value.length, length - 1) })}>
						<Text className={inputOTPCharVariants({ size })}>{value.charAt(index)}</Text>
					</View>
				))}
				{/* The one real input, stretched over the cells so a tap anywhere focuses it; drawn invisible. */}
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
					maxLength={length}
					keyboardType={keyboardType}
					textContentType="oneTimeCode"
					autoComplete="one-time-code"
					autoFocus={autoFocus}
					autoCorrect={false}
					caretHidden
					testID={testID}
					className="absolute inset-0 font-sans opacity-0"
				/>
			</View>
		);
	}),
);
