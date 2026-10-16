import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Kbd } from "@workspace/ui/components/kbd";

export function InputGroup13Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<InputGroup>
				<InputGroupInput placeholder="Search documentation..." />
				<InputGroupAddon align="inline-end">
					<Kbd>⌘K</Kbd>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
