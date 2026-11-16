import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function Checkbox4Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="w-auto">
			<Checkbox id="indeterminate" indeterminate />
			<FieldLabel htmlFor="indeterminate">Indeterminate state</FieldLabel>
		</Field>
	);
}
