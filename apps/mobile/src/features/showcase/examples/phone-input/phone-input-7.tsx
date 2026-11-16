import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

export function PhoneInput7Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <PhoneInput value={value} onChange={setValue} defaultCountry="FR" placeholder="06 12 34 56 78" accessibilityLabel="Phone number" />;
}
