import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function InputDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="input-dont-1-email">Email</FieldLabel>
			<Input id="input-dont-1-email" type="text" />
		</Field>
	);
}
