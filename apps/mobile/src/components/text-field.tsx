// A labelled text input. Controlled and data-agnostic: it renders the value
// and the error it is given; validation lives in the form's zod schema
// (rules/06, rules/07). The standard field contract maps onto React Native's:
// onChange(value) ← onChangeText, onBlur, onFocus.

import * as React from "react";
import { TextInput, View, type TextInputProps } from "react-native";

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

export const TextField = React.forwardRef<TextInput, TextFieldProps>(function TextField(
	{ label, value, onChange, normalize, onBlur, onFocus, error, hint, placeholder, testID, ...inputProps },
	ref,
): React.JSX.Element {
	const hasError = error !== undefined && error.length > 0;
	const handleChangeText = React.useCallback(
		(text: string): void => {
			onChange(normalize === undefined ? text : normalize(text));
		},
		[normalize, onChange],
	);
	return (
		<View className="gap-1.5">
			<Label>{label}</Label>
			<TextInput
				ref={ref}
				accessibilityLabel={label}
				accessibilityHint={hint}
				accessibilityState={{ disabled: inputProps.editable === false }}
				value={value}
				onChangeText={handleChangeText}
				onBlur={onBlur}
				onFocus={onFocus}
				placeholder={placeholder}
				testID={testID}
				placeholderTextColorClassName="accent-muted-foreground"
				className={`min-h-11 rounded-lg border bg-card px-3 py-2.5 text-base text-foreground ${hasError ? "border-destructive" : "border-input"}`}
				{...inputProps}
			/>
			{hint === undefined ? null : <MutedText>{hint}</MutedText>}
			{hasError ? (
				<ErrorText accessibilityRole="alert" accessibilityLiveRegion="polite">
					{error}
				</ErrorText>
			) : null}
		</View>
	);
});
