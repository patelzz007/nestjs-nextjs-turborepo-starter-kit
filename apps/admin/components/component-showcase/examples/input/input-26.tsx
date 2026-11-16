import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input26Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="subtle-bg">Subtle Background</FieldLabel>
			<Input id="subtle-bg" className="bg-muted transition-colors duration-300 hover:bg-muted focus-visible:bg-muted" placeholder="Enter text..." />
		</Field>
	);
}
