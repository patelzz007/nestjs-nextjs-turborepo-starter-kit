import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

export function PhoneInput3Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("+12125550123");
	return <PhoneInput value={value} onChange={setValue} size="lg" defaultCountry="US" accessibilityLabel="Phone number" />;
}
