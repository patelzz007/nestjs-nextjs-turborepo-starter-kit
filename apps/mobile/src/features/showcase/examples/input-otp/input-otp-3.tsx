import { InputOTP } from "@workspace/ui-native/components/input-otp";
import * as React from "react";

export function InputOtp3Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("123456");
	return <InputOTP value={value} onChange={setValue} length={6} keyboardType="number-pad" accessibilityLabel="Code" />;
}
