"use client";

import * as React from "react";
import { Label } from "@workspace/ui/components/label";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/password-strength-meter";
import { passwordStrength } from "@workspace/client/lib/contexts/identity/password";

export function PasswordStrengthMeter1Example(): React.JSX.Element {
	const [password, setPassword] = React.useState<string>("Correct-horse");
	const strength = React.useMemo(() => passwordStrength(password), [password]);

	const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(event.currentTarget.value);
	}, []);

	return (
		<div className="flex w-full max-w-md flex-col gap-3">
			<div className="flex flex-col gap-1.5">
				<Label htmlFor="usage-strength-password">Try a password</Label>
				<PasswordInput id="usage-strength-password" value={password} onChange={handleChange} autoComplete="off" />
			</div>
			<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
		</div>
	);
}
