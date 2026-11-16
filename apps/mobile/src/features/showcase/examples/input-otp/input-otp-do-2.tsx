import { Field } from "@workspace/ui-native/components/field";
import { InputOTP } from "@workspace/ui-native/components/input-otp";
import * as React from "react";

export function InputOtpDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Code" hint="Sent to •••• 4821.">
			<InputOTP value={value} onChange={setValue} length={6} keyboardType="number-pad" />
		</Field>
	);
}
