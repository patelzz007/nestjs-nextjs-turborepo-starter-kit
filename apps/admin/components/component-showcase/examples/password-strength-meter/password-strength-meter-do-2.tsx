import * as React from "react";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/password-strength-meter";

export function PasswordStrengthMeterDo2Example(): React.JSX.Element {
	return (
		<div className="flex w-full max-w-xs flex-col gap-2">
			<Field>
				<FieldLabel htmlFor="password-strength-meter-do-2">New password</FieldLabel>
				<PasswordInput id="password-strength-meter-do-2" autoComplete="new-password" defaultValue="Correct-horse-9" />
			</Field>
			<PasswordStrengthMeter score={3} label="Strong" percent={75} />
		</div>
	);
}
