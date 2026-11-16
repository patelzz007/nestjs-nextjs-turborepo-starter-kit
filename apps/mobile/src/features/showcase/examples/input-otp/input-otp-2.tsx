import { InputOTP } from "@workspace/ui-native/components/input-otp";
import * as React from "react";

function digitsOnly(text: string): string {
	return text.replace(/\D/gu, "");
}

export function InputOtp2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <InputOTP value={value} onChange={setValue} length={6} keyboardType="number-pad" normalize={digitsOnly} accessibilityLabel="Code" />;
}
