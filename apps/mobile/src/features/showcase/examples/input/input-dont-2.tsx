import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";
import { View } from "react-native";

export function InputDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<View className="gap-3">
			<Field label="First name">
				<Input value={value} onChange={setValue} />
			</Field>
			<Field label="Last name">
				<Input value={value} onChange={setValue} variant="underline" />
			</Field>
		</View>
	);
}
