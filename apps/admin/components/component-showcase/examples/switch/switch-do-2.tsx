import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

export function SwitchDo2Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="w-64 justify-between">
			<FieldLabel htmlFor="switch-do-2">Notifications</FieldLabel>
			<Switch id="switch-do-2" />
		</Field>
	);
}
