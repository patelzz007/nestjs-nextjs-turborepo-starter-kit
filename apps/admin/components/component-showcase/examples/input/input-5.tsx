import * as React from "react";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input5Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="input-demo-error">Email</FieldLabel>
			<Input id="input-demo-error" type="email" placeholder="name@example.com" aria-invalid="true" />
			<FieldError>Please enter a valid email address.</FieldError>
		</Field>
	);
}
