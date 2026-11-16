import { Field } from "@workspace/ui-native/components/field";
import { PhoneInput } from "@workspace/ui-native/components/phone-input";
import * as React from "react";

export function PhoneInput5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("+12133734253");
	return (
		<Field label="Phone">
			<PhoneInput value={value} onChange={setValue} />
		</Field>
	);
}
