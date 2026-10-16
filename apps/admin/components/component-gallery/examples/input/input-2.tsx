import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="input-demo-email">Email</FieldLabel>
			<Input id="input-demo-email" type="email" placeholder="name@example.com" />
		</Field>
	);
}
