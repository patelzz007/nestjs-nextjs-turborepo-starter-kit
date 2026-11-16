import * as React from "react";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";

export function Textarea4Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<Field className="w-full">
				<FieldLabel htmlFor="textarea-with-desc">Feedback</FieldLabel>
				<Textarea id="textarea-with-desc" placeholder="Type your message here…" rows={6} />
				<FieldDescription>Type your message and press enter to send.</FieldDescription>
			</Field>
		</div>
	);
}
