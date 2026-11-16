import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function Checkbox6Example(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-4">
			<Field orientation="horizontal" className="w-auto">
				<Checkbox id="color-1" defaultChecked className="data-checked:border-info data-checked:bg-info" />
				<FieldLabel htmlFor="color-1">Blue checkbox</FieldLabel>
			</Field>
			<Field orientation="horizontal" className="w-auto">
				<Checkbox id="color-2" defaultChecked className="data-checked:border-success data-checked:bg-success" />
				<FieldLabel htmlFor="color-2">Green checkbox</FieldLabel>
			</Field>
			<Field orientation="horizontal" className="w-auto">
				<Checkbox id="color-3" defaultChecked className="data-checked:border-warning data-checked:bg-warning" />
				<FieldLabel htmlFor="color-3">Yellow checkbox</FieldLabel>
			</Field>
		</div>
	);
}
