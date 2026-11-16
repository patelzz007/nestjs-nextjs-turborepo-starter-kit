import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

export function PhoneInput2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("+31612345678");
	return <PhoneInput value={value} onChange={setValue} size="sm" accessibilityLabel="Phone number" />;
}
