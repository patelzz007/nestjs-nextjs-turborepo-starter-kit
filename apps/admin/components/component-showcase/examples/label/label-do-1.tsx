import * as React from "react";
import { Field, FieldDescription } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function LabelDo1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-do-1-email">Work email</Label>
			<Input id="label-do-1-email" type="email" aria-describedby="label-do-1-hint" />
			<FieldDescription id="label-do-1-hint">We send the invoice here.</FieldDescription>
		</Field>
	);
}
