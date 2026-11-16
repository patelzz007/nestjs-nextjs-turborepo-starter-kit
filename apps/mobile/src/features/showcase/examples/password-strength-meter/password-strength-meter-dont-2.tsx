import { Field } from "@workspace/ui-native/components/field";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import { PasswordStrengthMeter } from "@workspace/ui-native/components/password-strength-meter";
import * as React from "react";
import { View } from "react-native";

export function PasswordStrengthMeterDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<View className="gap-2">
			<Field label="Password">
				<PasswordInput value={value} onChange={setValue} />
			</Field>
			<PasswordStrengthMeter score={1} label="Weak" percent={25} />
		</View>
	);
}
