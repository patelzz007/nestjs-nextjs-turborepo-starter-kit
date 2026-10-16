import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input7Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="input-demo-password">Password</FieldLabel>
			<Input id="input-demo-password" type="password" placeholder="Password" />
		</Field>
	);
}
