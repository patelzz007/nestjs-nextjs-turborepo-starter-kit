import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupInput } from "@workspace/ui/components/input-group";

export function InputGroup3Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs" data-invalid="true">
			<InputGroup>
				<InputGroupInput placeholder="Invalid field" aria-invalid="true" />
			</InputGroup>
		</Field>
	);
}
