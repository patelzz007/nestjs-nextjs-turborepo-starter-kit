import * as React from "react";
import { InfoIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@workspace/ui/components/input-group";

export function InputGroup16Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<InputGroup className="h-auto">
				<InputGroupInput placeholder="First name" />
				<InputGroupAddon align="block-start">
					<InputGroupText className="font-medium">User Profile</InputGroupText>
					<InfoIcon className="ml-auto" />
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
