import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function PasswordInputDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="password-input-dont-1">Password</FieldLabel>
			<Input id="password-input-dont-1" type="password" autoComplete="current-password" />
		</Field>
	);
}
