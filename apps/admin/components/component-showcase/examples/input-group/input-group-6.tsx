import * as React from "react";
import { MicIcon, RadioIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup6Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupAddon>
					<MicIcon />
				</InputGroupAddon>
				<InputGroupInput placeholder="Listening..." />
				<InputGroupAddon align="inline-end">
					<RadioIcon className="animate-pulse text-destructive" />
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
