import * as React from "react";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function FieldDont2Example(): React.JSX.Element {
	return (
		<Field data-invalid className="w-full max-w-xs">
			<FieldLabel htmlFor="field-dont-2-email">Email</FieldLabel>
			<Input id="field-dont-2-email" type="email" defaultValue="ada@" aria-invalid aria-describedby="field-dont-2-error" />
			<FieldError id="field-dont-2-error">Invalid</FieldError>
		</Field>
	);
}
