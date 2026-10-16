import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function Label4Example(): React.JSX.Element {
	return (
		<Field data-disabled className="w-full max-w-xs">
			<Label htmlFor="label-demo-disabled">Disabled Field</Label>
			<Input id="label-demo-disabled" placeholder="Disabled input…" disabled />
		</Field>
	);
}
