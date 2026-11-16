import { ButtonGroup, ButtonGroupText } from "@workspace/ui-native/components/button-group";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";

export function InputGroup27Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("acme");
	return (
		<ButtonGroup accessibilityLabel="Domain">
			<ButtonGroupText label="https://" variant="muted" />
			<InputGroup value={value} onChange={setValue} autoCapitalize="none" accessibilityLabel="Domain" className="flex-1" />
			<ButtonGroupText label=".com" variant="muted" />
		</ButtonGroup>
	);
}
