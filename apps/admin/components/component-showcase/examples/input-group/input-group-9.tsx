import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function InputGroup9Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<InputGroup>
				<InputGroupAddon>
					<InputGroupText>$</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput type="number" placeholder="0.00" />
				<InputGroupAddon align="inline-end">
					<InputGroupText>USD</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
