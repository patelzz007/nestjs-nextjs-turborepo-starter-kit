import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function Switch1Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(false);
	return <Switch label="Airplane mode" controlPosition="start" checked={checked} onChange={setChecked} />;
}
