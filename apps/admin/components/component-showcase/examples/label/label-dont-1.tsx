import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function LabelDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-dont-1-email">Enter the work email address we should send every invoice to</Label>
			<Input id="label-dont-1-email" type="email" />
		</Field>
	);
}
