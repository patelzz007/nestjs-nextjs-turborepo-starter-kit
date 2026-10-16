import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function Checkbox1Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="w-auto">
			<Checkbox id="terms" />
			<FieldLabel htmlFor="terms">Basic checkbox</FieldLabel>
		</Field>
	);
}
