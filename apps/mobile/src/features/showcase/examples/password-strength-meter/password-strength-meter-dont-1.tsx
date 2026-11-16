import { PasswordStrengthMeter } from "@workspace/ui-native/components/password-strength-meter";
import * as React from "react";

export function PasswordStrengthMeterDont1Example(): React.JSX.Element {
	return <PasswordStrengthMeter score={2} label="Weak" percent={50} />;
}
