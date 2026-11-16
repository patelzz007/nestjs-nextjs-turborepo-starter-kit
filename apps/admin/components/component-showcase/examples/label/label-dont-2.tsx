import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function LabelDont2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-dont-2-name">Full name *</Label>
			<Input id="label-dont-2-name" />
		</Field>
	);
}
