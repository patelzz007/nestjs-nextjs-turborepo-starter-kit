import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input20Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="w-full max-w-xs">
			<FieldLabel htmlFor="horizontal-name" className="w-24">
				Name
			</FieldLabel>
			<Input id="horizontal-name" placeholder="John Doe" />
		</Field>
	);
}
