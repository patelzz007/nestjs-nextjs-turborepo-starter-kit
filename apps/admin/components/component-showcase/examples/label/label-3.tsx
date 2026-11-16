import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";

export function Label3Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-demo-message">Message</Label>
			<Textarea id="label-demo-message" placeholder="Type your message here…" />
		</Field>
	);
}
