import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function SwitchDo1Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return <Switch label="Push notifications" checked={checked} onChange={setChecked} />;
}
