import * as React from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from "@workspace/ui/components/field";

export function Checkbox9Example(): React.JSX.Element {
	return (
		<FieldGroup className="max-w-xs">
			<FieldLabel>
				<Field orientation="horizontal">
					<Checkbox defaultChecked />
					<FieldContent>
						<FieldTitle>Enable notifications</FieldTitle>
						<FieldDescription>You can enable or disable notifications at any time.</FieldDescription>
					</FieldContent>
				</Field>
			</FieldLabel>
		</FieldGroup>
	);
}
