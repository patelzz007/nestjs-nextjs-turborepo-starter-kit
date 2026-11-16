import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

export function PhoneInputDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <PhoneInput value={value} onChange={setValue} accessibilityLabel="Phone" />;
}
