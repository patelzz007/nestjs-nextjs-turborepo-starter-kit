import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

export function Checkbox1Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return <Checkbox label="Accept terms and conditions" checked={checked} onChange={setChecked} />;
}
