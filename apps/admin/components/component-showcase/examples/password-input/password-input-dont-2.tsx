import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { PasswordInput } from "@workspace/ui/components/password-input";

export function PasswordInputDont2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="password-input-dont-2">Password</FieldLabel>
			<PasswordInput id="password-input-dont-2" defaultValue="hunter2-saved" defaultVisible />
		</Field>
	);
}
