import * as React from "react";
import { PasswordStrengthMeter, type PasswordStrengthCriterion } from "@workspace/ui/components/password-strength-meter";

/** The rules, as the password stands. */
const CRITERIA: readonly PasswordStrengthCriterion[] = [
	{ label: "At least 12 characters", met: true },
	{ label: "A number", met: true },
	{ label: "A symbol", met: false },
];

export function PasswordStrengthMeterDo1Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<PasswordStrengthMeter score={2} label="Fair" percent={50} criteria={CRITERIA} />
		</div>
	);
}
