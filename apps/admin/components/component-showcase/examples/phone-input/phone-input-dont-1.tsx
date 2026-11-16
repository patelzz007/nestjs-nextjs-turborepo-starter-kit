import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { PhoneInput } from "@workspace/ui/components/phone-input";

export function PhoneInputDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="phone-input-dont-1">Mobile number</FieldLabel>
			<PhoneInput id="phone-input-dont-1" />
		</Field>
	);
}
