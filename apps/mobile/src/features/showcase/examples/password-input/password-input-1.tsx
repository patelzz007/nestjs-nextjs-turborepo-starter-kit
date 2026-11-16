import { Field } from "@workspace/ui-native/components/field";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import * as React from "react";

export function PasswordInput1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const [visible, setVisible] = React.useState<boolean>(false);
	return (
		<Field label="Password">
			<PasswordInput value={value} onChange={setValue} visible={visible} onVisibleChange={setVisible} />
		</Field>
	);
}
