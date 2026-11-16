import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup1Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupInput placeholder="Search..." />
			</InputGroup>
		</Field>
	);
}
