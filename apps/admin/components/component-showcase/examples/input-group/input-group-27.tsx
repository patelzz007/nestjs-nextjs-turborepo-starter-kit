import * as React from "react";
import { InfoIcon } from "lucide-react";
import { ButtonGroup, ButtonGroupText } from "@workspace/ui/components/button-group";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup27Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<ButtonGroup>
				<ButtonGroupText>https://</ButtonGroupText>
				<InputGroup>
					<InputGroupInput placeholder="example" />
					<InputGroupAddon align="inline-end">
						<InfoIcon className="size-4 text-muted-foreground" />
					</InputGroupAddon>
				</InputGroup>
				<ButtonGroupText>.com</ButtonGroupText>
			</ButtonGroup>
		</Field>
	);
}
