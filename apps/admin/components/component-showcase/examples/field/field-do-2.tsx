import * as React from "react";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function FieldDo2Example(): React.JSX.Element {
	return (
		<Field data-invalid className="w-full max-w-xs">
			<FieldLabel htmlFor="field-do-2-email">Email</FieldLabel>
			<Input id="field-do-2-email" type="email" defaultValue="ada@" aria-invalid aria-describedby="field-do-2-error" />
			<FieldError id="field-do-2-error">Enter a valid email address, like name@example.com.</FieldError>
		</Field>
	);
}
