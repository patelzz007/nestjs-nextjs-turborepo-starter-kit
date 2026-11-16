import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";

/** The longest bio the profile shows. */
const BIO_LIMIT = 160;

export function TextareaDont2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="textarea-dont-2-bio">Bio</FieldLabel>
			<Textarea id="textarea-dont-2-bio" maxLength={BIO_LIMIT} defaultValue="Designer in Lisbon." />
		</Field>
	);
}
