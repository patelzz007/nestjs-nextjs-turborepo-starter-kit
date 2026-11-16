import XIcon from "lucide-react-native/icons/x";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroupDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const clear = React.useCallback((): void => {
		setValue("");
	}, []);
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			accessibilityLabel="Search"
			trailing={<IconButton icon={XIcon} label="Button" variant="ghost" size="sm" onPress={clear} />}
		/>
	);
}
