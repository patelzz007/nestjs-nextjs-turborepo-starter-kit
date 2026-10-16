import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";

export function Textarea5Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<Field className="w-full">
				<FieldLabel htmlFor="textarea-disabled">Message (Disabled)</FieldLabel>
				<Textarea id="textarea-disabled" placeholder="Type your message here…" disabled />
			</Field>
		</div>
	);
}
