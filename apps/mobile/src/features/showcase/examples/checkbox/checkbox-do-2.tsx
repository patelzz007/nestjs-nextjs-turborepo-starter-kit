import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

export function CheckboxDo2Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return <Checkbox label="I agree to the terms" checked={checked} onChange={setChecked} />;
}
