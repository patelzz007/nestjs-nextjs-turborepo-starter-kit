import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function InputDo2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-3">
			<Field>
				<FieldLabel htmlFor="input-do-2-first">First name</FieldLabel>
				<Input id="input-do-2-first" />
			</Field>
			<Field>
				<FieldLabel htmlFor="input-do-2-last">Last name</FieldLabel>
				<Input id="input-do-2-last" />
			</Field>
		</div>
	);
}
