import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";

export function TextareaDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="textarea-dont-1-city">City</FieldLabel>
			<Textarea id="textarea-dont-1-city" rows={4} />
		</Field>
	);
}
