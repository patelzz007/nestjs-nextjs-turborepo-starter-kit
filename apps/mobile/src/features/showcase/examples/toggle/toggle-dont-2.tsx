import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";

export function ToggleDont2Example(): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(false);
	return <Toggle label="Email notifications" variant="outline" pressed={pressed} onChange={setPressed} className="self-start" />;
}
