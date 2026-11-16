import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function InputGroupDo1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="input-group-do-1-price">Price</FieldLabel>
			<InputGroup>
				<InputGroupAddon>
					<InputGroupText>$</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput id="input-group-do-1-price" inputMode="decimal" defaultValue="24.00" />
				<InputGroupAddon align="inline-end">
					<InputGroupText>USD</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
