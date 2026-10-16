import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input14Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="input-demo-time">Time</FieldLabel>
			<Input id="input-demo-time" type="time" />
		</Field>
	);
}
