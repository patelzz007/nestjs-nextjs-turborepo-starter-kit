import { Field } from "@workspace/ui-native/components/field";
import { Input } from "@workspace/ui-native/components/input";
import * as React from "react";
import { useWindowDimensions, View } from "react-native";

/** The width from which there is room for a label beside its input. */
const TABLET_WIDTH = 600;

export function Field9Example(): React.JSX.Element {
	const [name, setName] = React.useState<string>("");
	const [email, setEmail] = React.useState<string>("");
	// Labels beside the inputs on a tablet, above them on a phone.
	const wide = useWindowDimensions().width >= TABLET_WIDTH;
	return (
		<View className="gap-4">
			<Field label="Name" orientation={wide ? "horizontal" : "vertical"}>
				<Input value={name} onChange={setName} />
			</Field>
			<Field label="Email" orientation={wide ? "horizontal" : "vertical"}>
				<Input value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
			</Field>
		</View>
	);
}
