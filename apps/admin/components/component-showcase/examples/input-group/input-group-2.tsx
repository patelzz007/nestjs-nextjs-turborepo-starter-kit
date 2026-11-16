import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup2Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs" data-disabled="true">
			<InputGroup>
				<InputGroupInput placeholder="Disabled field" disabled />
			</InputGroup>
		</Field>
	);
}
