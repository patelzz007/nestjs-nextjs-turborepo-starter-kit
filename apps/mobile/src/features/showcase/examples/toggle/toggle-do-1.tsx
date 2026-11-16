import BoldIcon from "lucide-react-native/icons/bold";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";

export function ToggleDo1Example(): React.JSX.Element {
	const [pressed, setPressed] = React.useState<boolean>(true);
	return <Toggle label="Bold" icon={BoldIcon} pressed={pressed} onChange={setPressed} className="self-start" />;
}
