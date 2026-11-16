import { PasswordStrengthMeter } from "@workspace/ui-native/components/password-strength-meter";
import * as React from "react";

const CRITERIA = [
	{ label: "At least 8 characters", met: true },
	{ label: "A number", met: false },
];

export function PasswordStrengthMeterDo1Example(): React.JSX.Element {
	return <PasswordStrengthMeter score={2} label="Fair" percent={50} criteria={CRITERIA} />;
}
