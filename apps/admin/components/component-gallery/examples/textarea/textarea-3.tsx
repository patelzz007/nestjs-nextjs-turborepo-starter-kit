import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";

export function Textarea3Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<Field className="w-full">
				<FieldLabel htmlFor="textarea-with-label">Your Message</FieldLabel>
				<Textarea id="textarea-with-label" placeholder="Type your message here…" rows={6} />
			</Field>
		</div>
	);
}
