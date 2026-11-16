import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";

export function PhoneInputDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Input value={value} onChange={setValue} keyboardType="phone-pad" accessibilityLabel="Phone" />;
}
