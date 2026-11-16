import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

export function CheckboxDont2Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return <Checkbox label="Dark mode" checked={checked} onChange={setChecked} />;
}
