import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field } from "@workspace/ui/components/field";
import { Label } from "@workspace/ui/components/label";

export function Label2Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="mx-auto w-auto">
			<Checkbox id="label-demo-terms" />
			<Label htmlFor="label-demo-terms">Accept terms and conditions</Label>
		</Field>
	);
}
