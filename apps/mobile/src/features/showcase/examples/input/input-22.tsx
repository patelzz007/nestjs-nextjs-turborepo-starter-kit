import { Field } from "@workspace/ui-native/components/field";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import * as React from "react";

/** The length below which a password is too short. */
const MIN_LENGTH = 8;

interface Hint {
	readonly text: string;
	readonly weak: boolean;
}

/** One line on the password, from grey to red to done. */
function hintFor(password: string): Hint {
	if (password.length === 0) {
		return { text: "Use 8 or more characters.", weak: false };
	}
	return password.length < MIN_LENGTH ? { text: "Too short: use 8 or more characters.", weak: true } : { text: "Good: long enough.", weak: false };
}

export function Input22Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const hint = hintFor(value);
	return (
		<Field label="Password" hint={hint.text}>
			<PasswordInput value={value} onChange={setValue} invalid={hint.weak} />
		</Field>
	);
}
