import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function InputGroup31Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupAddon className="pr-0 pl-3">
					<InputGroupText className="text-muted-foreground">€</InputGroupText>
				</InputGroupAddon>
				<InputGroupInput placeholder="0.00" className="border-r border-border" />
				<InputGroupAddon align="inline-end" className="pl-2">
					<InputGroupText>EUR</InputGroupText>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
