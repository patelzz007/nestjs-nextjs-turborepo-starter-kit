import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup10Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<InputGroup>
				<InputGroupInput placeholder="Query..." />
				<InputGroupAddon align="inline-end">
					<InputGroupButton>Search</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
