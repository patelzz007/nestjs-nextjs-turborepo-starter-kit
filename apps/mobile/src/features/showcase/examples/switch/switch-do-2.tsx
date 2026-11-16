import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function SwitchDo2Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return <Switch label="Notifications" checked={checked} onChange={setChecked} />;
}
