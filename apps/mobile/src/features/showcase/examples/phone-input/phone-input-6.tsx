import { Field } from "@workspace/ui-native/components/field";
import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

export function PhoneInput6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Phone" error="Enter a phone number.">
			<PhoneInput value={value} onChange={setValue} defaultCountry="MY" />
		</Field>
	);
}
