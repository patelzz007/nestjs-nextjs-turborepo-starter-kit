import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input8Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="input-demo-tel">Phone</FieldLabel>
			<Input id="input-demo-tel" type="tel" placeholder="+1 (555) 123-4567" />
		</Field>
	);
}
