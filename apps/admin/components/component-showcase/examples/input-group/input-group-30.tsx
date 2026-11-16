import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function InputGroup30Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupAddon className="pr-2">
					<InputGroupText>€</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput placeholder="0.00" className="border-x border-border" />
				<InputGroupAddon align="inline-end" className="pl-2">
					<InputGroupText>EUR</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
