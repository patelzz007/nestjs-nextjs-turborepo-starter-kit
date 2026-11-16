import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function SwitchDont2Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return <Switch label="Notifications on" checked={checked} onChange={setChecked} />;
}
