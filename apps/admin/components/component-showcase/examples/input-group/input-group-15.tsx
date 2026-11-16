import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Spinner } from "@workspace/ui/components/spinner";

export function InputGroup15Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs" data-disabled="true">
			<InputGroup>
				<InputGroupInput defaultValue="shadcn_ui" disabled />
				<InputGroupAddon align="inline-end">
					<Spinner />
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
