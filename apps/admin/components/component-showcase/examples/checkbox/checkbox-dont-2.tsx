import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function CheckboxDont2Example(): React.JSX.Element {
	return (
		<div className="flex w-64 items-center justify-between rounded-md border border-border p-3">
			<Field orientation="horizontal">
				<Checkbox id="checkbox-dont-2" />
				<FieldLabel htmlFor="checkbox-dont-2">Dark mode</FieldLabel>
			</Field>
		</div>
	);
}
