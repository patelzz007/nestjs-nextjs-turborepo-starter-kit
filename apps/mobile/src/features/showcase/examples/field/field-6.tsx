import { Field } from "@workspace/ui-native/components/field";
import { InputOTP } from "@workspace/ui-native/components/input-otp";
import { NativeSelect, type NativeSelectOption } from "@workspace/ui-native/components/native-select";
import * as React from "react";
import { View } from "react-native";

const METHODS: readonly NativeSelectOption<string>[] = [
	{ value: "sms", label: "Text message" },
	{ value: "email", label: "Email" },
	{ value: "app", label: "Authenticator app" },
];

export function Field6Example(): React.JSX.Element {
	const [method, setMethod] = React.useState<string | null>("sms");
	const [code, setCode] = React.useState<string>("");
	return (
		<View className="gap-4">
			<Field label="Send the code by">
				<NativeSelect label="Send the code by" options={METHODS} value={method} onChange={setMethod} />
			</Field>
			<Field label="Verification code" hint="We sent 6 digits.">
				<InputOTP value={code} onChange={setCode} length={6} keyboardType="number-pad" />
			</Field>
		</View>
	);
}
