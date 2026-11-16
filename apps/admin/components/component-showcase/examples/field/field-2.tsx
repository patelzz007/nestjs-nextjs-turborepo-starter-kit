import * as React from "react";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";

export function Field2Example(): React.JSX.Element {
	return (
		<div className="mx-auto w-full max-w-xs">
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="ticket-subject">Subject</FieldLabel>
					<Input id="ticket-subject" placeholder="Briefly describe the issue" />
					<FieldDescription>Use a clear and descriptive subject line.</FieldDescription>
				</Field>
				<Field>
					<div className="flex items-center justify-between">
						<FieldLabel htmlFor="ticket-message">Message</FieldLabel>
						<span className="text-xs text-muted-foreground">0/500</span>
					</div>
					<Textarea id="ticket-message" placeholder="Tell us more about your problem…" className="min-h-[120px]" />
					<FieldDescription>Include any relevant details to help us resolve your issue.</FieldDescription>
				</Field>
			</FieldGroup>
		</div>
	);
}
