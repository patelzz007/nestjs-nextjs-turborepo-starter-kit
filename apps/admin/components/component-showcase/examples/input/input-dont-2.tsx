import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function InputDont2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-3">
			<Field>
				<FieldLabel htmlFor="input-dont-2-first">First name</FieldLabel>
				<Input id="input-dont-2-first" className="border-0 bg-muted" />
			</Field>
			<Field>
				<FieldLabel htmlFor="input-dont-2-last">Last name</FieldLabel>
				<Input id="input-dont-2-last" className="rounded-none border-0 border-b shadow-none" />
			</Field>
		</div>
	);
}
