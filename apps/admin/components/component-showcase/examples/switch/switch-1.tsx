import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

export function Switch1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Field orientation="horizontal">
				<Switch id="switch-basic" />
				<FieldLabel htmlFor="switch-basic">Airplane Mode</FieldLabel>
			</Field>
		</div>
	);
}
