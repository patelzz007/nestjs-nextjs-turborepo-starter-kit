import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { Field } from "@workspace/ui-native/components/field";
import * as React from "react";

export function Checkbox3Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return (
		<Field error="You must accept the terms.">
			<Checkbox label="Accept terms and conditions" checked={checked} onChange={setChecked} invalid />
		</Field>
	);
}
