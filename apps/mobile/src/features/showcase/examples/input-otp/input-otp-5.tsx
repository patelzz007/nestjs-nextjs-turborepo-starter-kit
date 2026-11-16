import { Field } from "@workspace/ui-native/components/field";
import { InputOTP } from "@workspace/ui-native/components/input-otp";
import * as React from "react";

export function InputOtp5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="PIN" hint="Enter your 4-digit PIN.">
			<InputOTP value={value} onChange={setValue} length={4} keyboardType="number-pad" />
		</Field>
	);
}
