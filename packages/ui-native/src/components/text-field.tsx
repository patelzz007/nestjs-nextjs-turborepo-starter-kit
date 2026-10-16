// A labelled text input, ready for a form: `Field` (label, hint, error) around
// an `Input` — a `PasswordInput` when `secureTextEntry` is set, a `Textarea`
// when `multiline` is. Controlled and data-agnostic: it renders the value and
// the error it is given; validation lives in the form's zod schema (rules/06,
// rules/07). The standard field contract maps onto React Native's:
// onChange(value) ← onChangeText, onBlur, onFocus.
//
// A password field gets an eye button named after the field ("Show current
// password"). Whether the password is showing is the field's own display
// state; it starts hidden every time the field mounts.

import * as React from "react";
import type { TextInput } from "react-native";

import { Field } from "./field";
import { Input, type InputProps, type InputSize, type InputVariant } from "./input";
import { PasswordInput } from "./password-input";
import { Textarea } from "./textarea";

type PassThroughInputProps = Pick<
	InputProps,
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
	| "normalize"
	| "onBlur"
	| "onFocus"
>;

export interface TextFieldProps extends PassThroughInputProps {
	/** Visible label and the field's accessible name. */
	readonly label: string;
	readonly value: string;
	readonly onChange: (value: string) => void;
	/** The first validation message, or nothing. */
	readonly error?: string | undefined;
	/** A hint under the field (format, rules). */
	readonly hint?: string | undefined;
	/** Several lines (a comment, a review): taller, wrapping, starting at the top. */
	readonly multiline?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** Work is in flight for this value: a spinner, and no input. */
	readonly loading?: boolean | undefined;
	/** `false` takes no input, like `disabled` (kept for React Native's own name). */
	readonly editable?: boolean | undefined;
	/** The input's look (the kit's `Input` variants), passed through to the control. */
	readonly variant?: InputVariant | undefined;
	readonly size?: InputSize | undefined;
	/** Extra classes for the field's container, merged last. */
	readonly className?: string | undefined;
	/** Set on the `TextInput`; the eye button gets `<testID>-visibility`. */
	readonly testID?: string | undefined;
}

export const TextField = React.memo(
	React.forwardRef<TextInput, TextFieldProps>(function TextField(
		{ label, error, hint, multiline = false, secureTextEntry = false, disabled = false, loading = false, editable = true, className, ...inputProps },
		ref,
	): React.JSX.Element {
		const lowerCaseLabel = label.toLowerCase();
		const isDisabled = disabled || !editable;
		const control = (): React.JSX.Element => {
			if (secureTextEntry) {
				return <PasswordInput ref={ref} showLabel={`Show ${lowerCaseLabel}`} hideLabel={`Hide ${lowerCaseLabel}`} {...inputProps} />;
			}
			return multiline ? <Textarea ref={ref} {...inputProps} /> : <Input ref={ref} {...inputProps} />;
		};
		return (
			<Field label={label} hint={hint} error={error} disabled={isDisabled} loading={loading} className={className}>
				{control()}
			</Field>
		);
	}),
);
