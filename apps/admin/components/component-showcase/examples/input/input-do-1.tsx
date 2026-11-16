import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function InputDo1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="input-do-1-email">Email</FieldLabel>
			<Input id="input-do-1-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />
		</Field>
	);
}
