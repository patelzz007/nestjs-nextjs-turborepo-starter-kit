import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function Switch2Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return <Switch label="Share analytics" description="Help us improve the app by sharing anonymous usage data." checked={checked} onChange={setChecked} />;
}
