import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";
import { Button } from "@workspace/ui/components/button";

export function SwitchDont1Example(): React.JSX.Element {
	return (
		<form className="flex w-64 flex-col gap-3">
			<Field orientation="horizontal" className="justify-between">
				<FieldLabel htmlFor="switch-dont-1">Newsletter</FieldLabel>
				<Switch id="switch-dont-1" defaultChecked />
			</Field>
			<Button type="button" size="sm" className="self-start">
				Save
			</Button>
		</form>
	);
}
