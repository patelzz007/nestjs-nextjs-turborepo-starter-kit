import { InputOTP } from "@workspace/ui-native/components/input-otp";
import * as React from "react";

/** Letters and digits, upper-cased; symbols are dropped. */
function lettersAndDigits(text: string): string {
	return text.replace(/[^a-z\d]/giu, "").toUpperCase();
}

export function InputOtp4Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <InputOTP value={value} onChange={setValue} length={6} normalize={lettersAndDigits} accessibilityLabel="Code" />;
}
