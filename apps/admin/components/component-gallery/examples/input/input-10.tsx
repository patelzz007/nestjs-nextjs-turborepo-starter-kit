import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input10Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="input-demo-number">Number</FieldLabel>
			<Input id="input-demo-number" type="number" placeholder="123" />
		</Field>
	);
}
