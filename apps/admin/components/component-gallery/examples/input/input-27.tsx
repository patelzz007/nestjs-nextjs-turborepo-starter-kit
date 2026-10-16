import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input27Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="bottom-border">Bottom Border Only</FieldLabel>
			<Input
				id="bottom-border"
				className="rounded-none border-x-0 border-t-0 border-b-2 px-0 shadow-none focus-visible:border-primary focus-visible:ring-0"
				placeholder="Type here..."
			/>
		</Field>
	);
}
