import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

export function CheckboxDont1Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return <Checkbox label="Don't email me product updates" checked={checked} onChange={setChecked} />;
}
