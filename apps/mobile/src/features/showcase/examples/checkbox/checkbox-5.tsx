import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";

export function Checkbox5Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return <Checkbox label="Accept terms and conditions" description="You agree to our terms of service and privacy policy." checked={checked} onChange={setChecked} />;
}
