import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/password-strength-meter";

export function PasswordStrengthMeterDont2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-2">
			<Field>
				<FieldLabel htmlFor="password-strength-meter-dont-2">Password</FieldLabel>
				<PasswordInput id="password-strength-meter-dont-2" autoComplete="current-password" defaultValue="hunter2" />
			</Field>
			<PasswordStrengthMeter score={1} label="Weak" percent={25} />
		</div>
	);
}
