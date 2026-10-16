import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input4Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="input-demo-disabled">Email</FieldLabel>
			<Input id="input-demo-disabled" type="email" placeholder="Email" disabled />
		</Field>
	);
}
