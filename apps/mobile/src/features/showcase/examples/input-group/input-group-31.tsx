import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import { Text } from "react-native";

export function InputGroup31Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("240.00");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leadingText="€"
			keyboardType="decimal-pad"
			accessibilityLabel="Amount"
			footer={<Text className="text-caption px-1 font-sans text-muted-foreground">Fees are added at checkout.</Text>}
		/>
	);
}
