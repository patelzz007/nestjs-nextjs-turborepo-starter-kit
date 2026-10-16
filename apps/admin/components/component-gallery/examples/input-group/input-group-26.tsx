import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@workspace/ui/components/input-group";

export function InputGroup26Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupTextarea placeholder="Share your thoughts..." className="min-h-24" />
				<InputGroupAddon align="block-end">
					<InputGroupButton variant="secondary" size="sm">
						Cancel
					</InputGroupButton>
					<InputGroupButton variant="default" size="sm" className="ml-auto">
						Post Comment
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
