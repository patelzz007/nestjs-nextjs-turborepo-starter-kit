import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function LabelDo2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-do-2-name">
				Full name
				<span aria-hidden="true" className="text-destructive">
					*
				</span>
			</Label>
			<Input id="label-do-2-name" required />
		</Field>
	);
}
