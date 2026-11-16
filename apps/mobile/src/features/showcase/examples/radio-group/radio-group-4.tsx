import { Field } from "@workspace/ui-native/components/field";
import { RadioGroup, type RadioOption } from "@workspace/ui-native/components/radio-group";
import * as React from "react";

const CONTACT: readonly RadioOption<string>[] = [
	{ value: "email", label: "Email" },
	{ value: "sms", label: "SMS" },
];

export function RadioGroup4Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return (
		<Field error="Pick how we contact you.">
			<RadioGroup label="Contact by" options={CONTACT} value={value} onChange={setValue} invalid />
		</Field>
	);
}
