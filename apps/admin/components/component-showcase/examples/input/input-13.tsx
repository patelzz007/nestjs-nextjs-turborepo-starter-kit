import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input13Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="company">
				Company <span className="text-destructive">*</span>
			</FieldLabel>
			<Input id="company" placeholder="Wotso Inc." />
		</Field>
	);
}
