import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function InputGroup8Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupInput placeholder="username" />
				<InputGroupAddon align="inline-end">
					<InputGroupText>@gmail.com</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
