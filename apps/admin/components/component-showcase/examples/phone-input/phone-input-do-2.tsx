import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { PhoneInput } from "@workspace/ui/components/phone-input";

export function PhoneInputDo2Example(): React.JSX.Element {
	const [phone, setPhone] = React.useState<string>("+60123456789");
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="phone-input-do-2">Mobile number</FieldLabel>
			<PhoneInput id="phone-input-do-2" defaultCountry="MY" value={phone} onChange={setPhone} />
			<p className="font-mono text-xs text-muted-foreground">{`Saved as ${phone}`}</p>
		</Field>
	);
}
