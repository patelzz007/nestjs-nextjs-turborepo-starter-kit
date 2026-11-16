import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function InputGroupDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="input-group-dont-1-price">Price</FieldLabel>
			<InputGroup>
				<InputGroupAddon>
					<InputGroupText>Amount in US dollars, before tax</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput id="input-group-dont-1-price" inputMode="decimal" defaultValue="24.00" />
			</InputGroup>
		</Field>
	);
}
