import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";

export function TextareaDo1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="textarea-do-1-feedback">What could we do better?</FieldLabel>
			<Textarea id="textarea-do-1-feedback" rows={4} />
		</Field>
	);
}
