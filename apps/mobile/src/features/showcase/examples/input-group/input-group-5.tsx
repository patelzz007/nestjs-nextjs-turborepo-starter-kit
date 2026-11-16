import MailIcon from "lucide-react-native/icons/mail";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			trailingIcon={MailIcon}
			placeholder="you@example.com"
			keyboardType="email-address"
			autoCapitalize="none"
			accessibilityLabel="Email"
		/>
	);
}
