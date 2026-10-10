// A labelled text input. Controlled and data-agnostic: it renders the value
// and the error it is given; validation lives in the form's zod schema
// (rules/06, rules/07). The standard field contract maps onto React Native's:
// onChange(value) ← onChangeText, onBlur, onFocus.
//
// A password field (`secureTextEntry`) gets an eye button that shows or hides
// what was typed. Whether the password is showing is the field's own display
// state; it starts hidden every time the field mounts.

import EyeIcon from "lucide-react-native/icons/eye";
import EyeOffIcon from "lucide-react-native/icons/eye-off";
import * as React from "react";
import { Pressable, TextInput, View, type TextInputProps } from "react-native";

import { Icon } from "./icon";
import { ErrorText, Label, MutedText } from "./text";

type PassThroughInputProps = Pick<
	TextInputProps,
	"autoCapitalize" | "autoComplete" | "autoCorrect" | "keyboardType" | "maxLength" | "returnKeyType" | "secureTextEntry" | "textContentType" | "onSubmitEditing" | "editable"
>;

export interface TextFieldProps extends PassThroughInputProps {
	/** Visible label and the field's accessible name. */
	readonly label: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	/** Input shaping applied before `onChange` (digits only, upper case) — never validation, which is the schema's job. */
	readonly normalize?: (value: string) => string;
	readonly onBlur?: () => void;
	readonly onFocus?: () => void;
	/** The first validation message, or nothing. */
	readonly error?: string | undefined;
	/** A hint under the field (format, rules). */
	readonly hint?: string;
	readonly placeholder?: string;
	readonly testID?: string;
}

/** Border per state: an error outranks focus. Token utilities only. */
function borderClassOf(hasError: boolean, isFocused: boolean): string {
	if (hasError) {
		return "border-destructive";
	}
	return isFocused ? "border-ring" : "border-input";
}

export const TextField = React.forwardRef<TextInput, TextFieldProps>(function TextField(
	{ label, value, onChange, normalize, onBlur, onFocus, error, hint, placeholder, testID, secureTextEntry, ...inputProps },
	ref,
): React.JSX.Element {
	const hasError = error !== undefined && error.length > 0;
	const [isFocused, setFocused] = React.useState(false);
	const [isPasswordVisible, setPasswordVisible] = React.useState(false);
	const isPassword = secureTextEntry === true;
	/** A password stays masked until its eye button is pressed. */
	const isMasked = isPassword && !isPasswordVisible;

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
	const togglePasswordVisible = React.useCallback((): void => {
		setPasswordVisible((visible: boolean): boolean => !visible);
	}, []);

	return (
		<View className="gap-1.5">
			<Label>{label}</Label>
			<View className="justify-center">
				<TextInput
					ref={ref}
					accessibilityLabel={label}
					accessibilityHint={hint}
					accessibilityState={{ disabled: inputProps.editable === false }}
					value={value}
					onChangeText={handleChangeText}
					onBlur={handleBlur}
					onFocus={handleFocus}
					placeholder={placeholder}
					testID={testID}
					secureTextEntry={isMasked}
					placeholderTextColorClassName="accent-muted-foreground"
					className={`min-h-12 rounded-xl border bg-card px-3.5 py-3 font-sans text-base text-foreground ${isPassword ? "pr-12" : ""} ${borderClassOf(hasError, isFocused)}`}
					{...inputProps}
				/>
				{isPassword ? (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={isPasswordVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
						onPress={togglePasswordVisible}
						hitSlop={4}
						testID={testID === undefined ? undefined : `${testID}-visibility`}
						className="absolute right-1 size-11 items-center justify-center rounded-full active:opacity-60">
						<Icon icon={isPasswordVisible ? EyeOffIcon : EyeIcon} size="md" colorClassName="accent-muted-foreground" />
					</Pressable>
				) : null}
			</View>
			{hint === undefined ? null : <MutedText>{hint}</MutedText>}
			{hasError ? (
				<ErrorText accessibilityRole="alert" accessibilityLiveRegion="polite">
					{error}
				</ErrorText>
			) : null}
		</View>
	);
});
