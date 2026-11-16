import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function CheckboxDont1Example(): React.JSX.Element {
	return (
		<div className="w-fit">
			<Field orientation="horizontal">
				<Checkbox id="checkbox-dont-1" />
				<FieldLabel htmlFor="checkbox-dont-1">Don&apos;t stop sending me updates</FieldLabel>
			</Field>
		</div>
	);
}
