import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

export function SwitchDo1Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="w-64 justify-between rounded-md border border-border p-3">
			<FieldLabel htmlFor="switch-do-1">Dark mode</FieldLabel>
			<Switch id="switch-do-1" defaultChecked />
		</Field>
	);
}
