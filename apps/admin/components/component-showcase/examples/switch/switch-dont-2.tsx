import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

export function SwitchDont2Example(): React.JSX.Element {
	return (
		<Field orientation="horizontal" className="w-64 justify-between">
			<FieldLabel htmlFor="switch-dont-2">Notifications on</FieldLabel>
			<Switch id="switch-dont-2" />
		</Field>
	);
}
