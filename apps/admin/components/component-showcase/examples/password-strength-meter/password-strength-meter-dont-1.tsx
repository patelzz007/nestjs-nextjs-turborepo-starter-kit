import * as React from "react";
import { PasswordStrengthMeter } from "@workspace/ui/components/password-strength-meter";

export function PasswordStrengthMeterDont1Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<PasswordStrengthMeter score={1} label="Weak" percent={25} />
		</div>
	);
}
