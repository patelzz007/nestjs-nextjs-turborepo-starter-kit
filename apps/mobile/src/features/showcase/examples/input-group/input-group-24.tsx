import CheckIcon from "lucide-react-native/icons/check";
import { Icon } from "@workspace/ui-native/components/icon";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import { View } from "react-native";

export function InputGroup24Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("avery");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			accessibilityLabel="Username"
			accessibilityHint="Available"
			trailing={
				<View className="size-5 items-center justify-center rounded-full bg-success">
					<Icon icon={CheckIcon} size="xs" colorClassName="accent-status-foreground" />
				</View>
			}
		/>
	);
}
