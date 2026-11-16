import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input31Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="minimal-input">Invisible Input</FieldLabel>
			<Input id="minimal-input" placeholder="Type here..." className="border-none bg-transparent p-0 shadow-none focus-visible:ring-0" />
		</Field>
	);
}
