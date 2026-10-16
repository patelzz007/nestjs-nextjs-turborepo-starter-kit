import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function Checkbox21Example(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-center gap-6">
			<Field orientation="horizontal" className="w-auto">
				<Checkbox id="inline-1" defaultChecked />
				<FieldLabel htmlFor="inline-1" className="cursor-pointer">
					Read
				</FieldLabel>
			</Field>
			<Field orientation="horizontal" className="w-auto">
				<Checkbox id="inline-2" />
				<FieldLabel htmlFor="inline-2" className="cursor-pointer">
					Write
				</FieldLabel>
			</Field>
			<Field orientation="horizontal" className="w-auto">
				<Checkbox id="inline-4" defaultChecked />
				<FieldLabel htmlFor="inline-4" className="cursor-pointer">
					Delete
				</FieldLabel>
			</Field>
		</div>
	);
}
