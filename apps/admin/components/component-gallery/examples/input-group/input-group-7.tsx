import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function InputGroup7Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupAddon>
					<InputGroupText>https://</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput placeholder="example.com" />
			</InputGroup>
		</Field>
	);
}
