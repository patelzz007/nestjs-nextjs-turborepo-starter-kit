import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import { Text } from "react-native";

const MAX = 280;

export function InputGroup17Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			multiline
			maxLength={MAX}
			placeholder="Describe the change…"
			accessibilityLabel="Description"
			footer={<Text className="text-caption ml-auto font-sans text-muted-foreground tabular-nums">{`${String(MAX - value.length)} left`}</Text>}
		/>
	);
}
