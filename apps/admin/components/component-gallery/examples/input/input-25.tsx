import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input25Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="custom-focus">Custom Focus</FieldLabel>
			<Input id="custom-focus" className="focus-visible:border-success focus-visible:ring-success/50" placeholder="Green focus ring" />
		</Field>
	);
}
