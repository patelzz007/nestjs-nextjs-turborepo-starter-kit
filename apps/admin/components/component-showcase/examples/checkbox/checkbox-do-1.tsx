import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function CheckboxDo1Example(): React.JSX.Element {
	return (
		<div className="w-fit">
			<Field orientation="horizontal">
				<Checkbox id="checkbox-do-1" />
				<FieldLabel htmlFor="checkbox-do-1">Email me product updates</FieldLabel>
			</Field>
		</div>
	);
}
