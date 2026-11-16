import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function ComboboxDont3Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="combobox-dont-3">Reviewers</FieldLabel>
			<Input id="combobox-dont-3" readOnly className="truncate" value="Ada Lovelace, Grace Hopper, Alan Turing, Katherine Johnson, Margaret Hamilton" />
		</Field>
	);
}
