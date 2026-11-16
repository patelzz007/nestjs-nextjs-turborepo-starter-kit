import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function Checkbox7Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="relative w-auto">
			<Checkbox id="circle" className="rounded-full" defaultChecked />
			<FieldLabel
				htmlFor="circle"
				className="relative transition-colors peer-data-checked:text-muted-foreground after:absolute after:inset-x-0 after:top-1/2 after:h-px after:-translate-y-1/2 after:scale-x-0 after:bg-current after:transition-transform peer-data-checked:after:scale-x-100">
				Circle checkbox
			</FieldLabel>
		</Field>
	);
}
