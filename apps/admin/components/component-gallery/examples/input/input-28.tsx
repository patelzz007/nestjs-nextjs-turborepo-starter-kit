import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input28Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="color-picker">Theme Color</FieldLabel>
			<Input id="color-picker" type="color" className="h-10 w-20 cursor-pointer p-1" defaultValue="#3b82f6" />
		</Field>
	);
}
