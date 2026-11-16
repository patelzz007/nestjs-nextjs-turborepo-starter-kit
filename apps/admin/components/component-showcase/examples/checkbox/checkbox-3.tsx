import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function Checkbox3Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="w-auto" data-invalid>
			<Checkbox id="invalid" aria-invalid />
			<FieldLabel htmlFor="invalid">Invalid checkbox</FieldLabel>
		</Field>
	);
}
