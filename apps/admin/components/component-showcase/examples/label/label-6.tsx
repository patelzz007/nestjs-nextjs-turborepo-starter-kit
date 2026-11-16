import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function Label6Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-optional">
				Phone number
				<span className="text-muted-foreground">(optional)</span>
			</Label>
			<Input id="label-optional" type="tel" placeholder="+1 (555) 000-0000" />
		</Field>
	);
}
