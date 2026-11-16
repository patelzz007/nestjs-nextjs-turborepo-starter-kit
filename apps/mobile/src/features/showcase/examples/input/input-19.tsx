import { Field } from "@workspace/ui-native/components/field";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import { TextLink } from "@workspace/ui-native/components/text-link";
import * as React from "react";

import { ignorePress } from "../example-support";

export function Input19Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Password" labelTrailing={<TextLink label="Forgot password?" onPress={ignorePress} size="sm" />}>
			<PasswordInput value={value} onChange={setValue} />
		</Field>
	);
}
