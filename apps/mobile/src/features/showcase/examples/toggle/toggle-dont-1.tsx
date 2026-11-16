import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";

export function ToggleDont1Example(): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(true);
	return <Toggle label="Make bold" pressed={pressed} onChange={setPressed} className="self-start" />;
}
