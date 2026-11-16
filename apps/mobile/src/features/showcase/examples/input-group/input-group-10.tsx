import { Button } from "@workspace/ui-native/components/button";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

import { ignorePress } from "../example-support";

export function InputGroup10Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<InputGroup
			value={value}
			onChange={setValue}
			placeholder="Search…"
			accessibilityLabel="Search"
			trailing={<Button label="Search" size="xs" variant="secondary" onPress={ignorePress} />}
		/>
	);
}
