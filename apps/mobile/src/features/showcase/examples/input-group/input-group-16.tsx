import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import { Text } from "react-native";

export function InputGroup16Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			placeholder="Display name"
			accessibilityLabel="Display name"
			header={<Text className="text-caption font-sans-medium text-muted-foreground">User profile</Text>}
		/>
	);
}
