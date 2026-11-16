import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

export function PhoneInput1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <PhoneInput value={value} onChange={setValue} placeholder="Phone number" accessibilityLabel="Phone number" />;
}
