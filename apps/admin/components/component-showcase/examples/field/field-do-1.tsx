import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function FieldDo1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="field-do-1-email">Email</FieldLabel>
			<Input id="field-do-1-email" type="email" defaultValue="ada@example.com" />
		</Field>
	);
}
