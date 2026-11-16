import EyeIcon from "lucide-react-native/icons/eye";
import EyeOffIcon from "lucide-react-native/icons/eye-off";
import LockIcon from "lucide-react-native/icons/lock";
import { IconButton } from "@workspace/ui-native/components/icon-button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup35Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const [visible, setVisible] = React.useState<boolean>(false);
	const toggle = React.useCallback((): void => {
		setVisible((shown: boolean): boolean => !shown);
	}, []);
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			leadingIcon={LockIcon}
			secureTextEntry={!visible}
			accessibilityLabel="Password"
			trailing={<IconButton icon={visible ? EyeOffIcon : EyeIcon} label={visible ? "Hide the password" : "Show the password"} variant="ghost" size="sm" onPress={toggle} />}
		/>
	);
}
