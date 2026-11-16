import * as React from "react";
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@workspace/ui/components/field";
import { Switch } from "@workspace/ui/components/switch";

export function Switch2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<FieldLabel htmlFor="switch-with-desc" className="w-full max-w-xs">
				<Field orientation="horizontal">
					<FieldContent>
						<FieldTitle>Share across devices</FieldTitle>
						<FieldDescription>Focus is shared across devices, and turns off when you leave the app.</FieldDescription>
					</FieldContent>
					<Switch id="switch-with-desc" />
				</Field>
			</FieldLabel>
		</div>
	);
}
