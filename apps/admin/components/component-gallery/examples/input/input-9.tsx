import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input9Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="input-demo-url">URL</FieldLabel>
			<Input id="input-demo-url" type="url" placeholder="https://example.com" />
		</Field>
	);
}
