import * as React from "react";
import { MailIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup5Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupInput type="email" placeholder="you@example.com" />
				<InputGroupAddon align="inline-end">
					<MailIcon />
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
