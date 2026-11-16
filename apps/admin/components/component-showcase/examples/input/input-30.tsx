import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input30Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="pill-input">Search</FieldLabel>
			<Input id="pill-input" className="rounded-full px-4" placeholder="Search everything..." />
		</Field>
	);
}
