import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

export function PhoneInputDo1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <PhoneInput value={value} onChange={setValue} defaultCountry="MY" accessibilityLabel="Phone" />;
}
