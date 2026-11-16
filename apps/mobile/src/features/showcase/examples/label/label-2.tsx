import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

export function Label2Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return <Checkbox label="I agree to the terms of service" checked={checked} onChange={setChecked} />;
}
