import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

export function Checkbox5Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="w-auto max-w-xs">
			<Checkbox id="terms-2" defaultChecked />
			<FieldContent>
				<FieldLabel htmlFor="terms-2">Accept terms and conditions</FieldLabel>
				<FieldDescription>This checkbox is used to accept the terms and conditions.</FieldDescription>
			</FieldContent>
		</Field>
	);
}
