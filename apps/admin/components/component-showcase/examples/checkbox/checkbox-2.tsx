import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function Checkbox2Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" data-disabled className="w-auto">
			<Checkbox id="disabled-2" disabled defaultChecked />
			<FieldLabel htmlFor="disabled-2">Disabled checkbox</FieldLabel>
		</Field>
	);
}
