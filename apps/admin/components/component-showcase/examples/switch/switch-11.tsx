import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

export function Switch11Example(): React.JSX.Element {
	return (
		<div className="flex flex-col gap-4">
			<Field orientation="horizontal" className="w-auto">
				<Switch id="sw-blue" defaultChecked className="data-checked:bg-info" />
				<FieldLabel htmlFor="sw-blue">Blue</FieldLabel>
			</Field>
			<Field orientation="horizontal" className="w-auto">
				<Switch id="sw-green" defaultChecked className="data-checked:bg-success" />
				<FieldLabel htmlFor="sw-green">Green</FieldLabel>
			</Field>
			<Field orientation="horizontal" className="w-auto">
				<Switch id="sw-yellow" defaultChecked className="data-checked:bg-warning" />
				<FieldLabel htmlFor="sw-yellow">Yellow</FieldLabel>
			</Field>
		</div>
	);
}
