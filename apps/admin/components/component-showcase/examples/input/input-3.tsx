import * as React from "react";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input3Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="input-demo-username">Username</FieldLabel>
			<Input id="input-demo-username" type="text" placeholder="Enter your username" />
			<FieldDescription>Choose a unique username for your account.</FieldDescription>
		</Field>
	);
}
