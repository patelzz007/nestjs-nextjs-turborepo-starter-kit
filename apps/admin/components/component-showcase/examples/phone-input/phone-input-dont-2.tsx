import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function PhoneInputDont2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="phone-input-dont-2">Mobile number</FieldLabel>
			<Input id="phone-input-dont-2" type="text" defaultValue="012-345 6789" />
		</Field>
	);
}
