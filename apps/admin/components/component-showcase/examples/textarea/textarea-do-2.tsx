import * as React from "react";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";

/** The longest bio the profile shows. */
const BIO_LIMIT = 160;

export function TextareaDo2Example(): React.JSX.Element {
	const [bio, setBio] = React.useState("Designer in Lisbon.");
	const change = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setBio(event.currentTarget.value);
	}, []);
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="textarea-do-2-bio">Bio</FieldLabel>
			<Textarea id="textarea-do-2-bio" value={bio} onChange={change} maxLength={BIO_LIMIT} aria-describedby="textarea-do-2-count" />
			<FieldDescription id="textarea-do-2-count" className="text-end tabular-nums">
				{`${String(bio.length)} / ${String(BIO_LIMIT)}`}
			</FieldDescription>
		</Field>
	);
}
