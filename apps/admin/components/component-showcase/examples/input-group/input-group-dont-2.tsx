import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { XIcon } from "lucide-react";

export function InputGroupDont2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="input-group-dont-2-search">Search</FieldLabel>
			<InputGroup>
				<InputGroupInput id="input-group-dont-2-search" defaultValue="invoices" />
				<InputGroupAddon align="inline-end">
					<InputGroupButton size="icon-xs">
						<XIcon />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
