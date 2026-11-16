import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Button } from "@workspace/ui/components/button";

export function CheckboxDo2Example(): React.JSX.Element {
	return (
		<form className="flex w-fit flex-col gap-3">
			<Field orientation="horizontal">
				<Checkbox id="checkbox-do-2" defaultChecked />
				<FieldLabel htmlFor="checkbox-do-2">Remember this device</FieldLabel>
			</Field>
			<Button type="button" size="sm" className="self-start">
				Save
			</Button>
		</form>
	);
}
