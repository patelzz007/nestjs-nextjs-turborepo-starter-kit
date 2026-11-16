import { Field } from "@workspace/ui-native/components/field";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import { View } from "react-native";

export function Field1Example(): React.JSX.Element {
	const [username, setUsername] = React.useState<string>("");
	const [email, setEmail] = React.useState<string>("");
	return (
		<View className="gap-4">
			<Field label="Username" required>
				<InputGroup value={username} onChange={setUsername} leadingText="@" autoCapitalize="none" />
			</Field>
			<Field label="Email" hint="Your work address at the company domain.">
				<InputGroup value={email} onChange={setEmail} trailingText="@acme.com" autoCapitalize="none" />
			</Field>
		</View>
	);
}
